import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";

type Reservation = {
  attempt_id: string;
  session_id: string | null;
  expires_at: string;
  parameters: Stripe.Checkout.SessionCreateParams;
};
export class CheckoutPendingError extends Error {}

/** Même réservation et mêmes paramètres, même après timeout ou redémarrage. */
export async function getOrCreateCheckout(
  admin: SupabaseClient,
  stripe: Stripe,
  userId: string,
  parameters: Stripe.Checkout.SessionCreateParams,
): Promise<Stripe.Checkout.Session> {
  // Un seul renouvellement après expiration confirmée par Stripe.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await admin.rpc("reserve_checkout", {
      p_user_id: userId,
      p_parameters: parameters,
    });
    if (error) {
      if (error.code === "23505")
        throw new CheckoutPendingError(
          "Votre abonnement est déjà actif — ouvrez le portail de facturation.",
        );
      throw error;
    }
    const reservation = data as Reservation | null;
    if (
      !reservation?.attempt_id ||
      !reservation.parameters ||
      !reservation.expires_at
    )
      throw new Error("Réservation de paiement invalide");
    const session = reservation.session_id
      ? await stripe.checkout.sessions.retrieve(reservation.session_id)
      : await stripe.checkout.sessions.create(
          {
            ...reservation.parameters,
            expires_at: Math.floor(
              new Date(reservation.expires_at).getTime() / 1000,
            ),
            metadata: {
              ...reservation.parameters.metadata,
              checkout_attempt: reservation.attempt_id,
            },
          },
          { idempotencyKey: `checkout:${reservation.attempt_id}` },
        );
    if (!reservation.session_id) {
      const { error: attachError } = await admin.rpc("attach_checkout", {
        p_user_id: userId,
        p_attempt_id: reservation.attempt_id,
        p_session_id: session.id,
      });
      if (attachError) throw attachError;
    }
    if (session.status === "expired") {
      const { error: releaseError } = await admin.rpc(
        "release_expired_checkout",
        { p_user_id: userId, p_attempt_id: reservation.attempt_id },
      );
      if (releaseError) throw releaseError;
      continue;
    }
    if (session.status === "complete")
      throw new CheckoutPendingError(
        "Paiement déjà effectué — l’activation est en cours. Rechargez votre abonnement.",
      );
    const oldPrice = reservation.parameters.line_items?.[0]?.price;
    const newPrice = parameters.line_items?.[0]?.price;
    if (oldPrice !== newPrice) {
      // Ne jamais ouvrir une deuxième session : fermer d'abord l'ancienne.
      // Stripe refuse l'expiration si elle a été payée entre-temps.
      const expired = await stripe.checkout.sessions.expire(session.id);
      if (expired.status !== "expired")
        throw new CheckoutPendingError("Un paiement est déjà en cours.");
      const { error: releaseError } = await admin.rpc(
        "release_expired_checkout",
        { p_user_id: userId, p_attempt_id: reservation.attempt_id },
      );
      if (releaseError) throw releaseError;
      continue;
    }
    return session;
  }
  throw new CheckoutPendingError(
    "La session de paiement vient de changer — réessayez.",
  );
}
