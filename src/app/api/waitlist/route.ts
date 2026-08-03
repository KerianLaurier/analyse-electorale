import { NextResponse } from "next/server";
import { createServiceClient, serviceRoleConfigured } from "@/lib/supabase/admin";

/**
 * Inscription à la liste d'attente de pré-lancement.
 *
 * Écrit dans `public.waitlist`, dont la RLS n'expose aucune policy : seul le
 * service_role peut y accéder. L'insertion passe donc obligatoirement par
 * cette route serveur — jamais depuis le navigateur (cf. 20260803_waitlist.sql).
 */

// Table non lisible publiquement et écriture à chaque appel : aucun cache.
export const dynamic = "force-dynamic";

// Volontairement permissif mais suffisant pour écarter les saisies erronées.
// La validation qui compte est celle de l'e-mail de confirmation, plus tard.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

const MAX_EMAIL_LEN = 254; // RFC 5321

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const raw = (payload as { email?: unknown })?.email;
  const email = typeof raw === "string" ? raw.trim().toLowerCase() : "";

  if (!email || email.length > MAX_EMAIL_LEN || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 });
  }

  if (!serviceRoleConfigured()) {
    // Déploiement sans SUPABASE_SERVICE_ROLE_KEY (aperçus, dev local) : on ne
    // peut pas écrire. On le signale clairement plutôt que de simuler un succès.
    return NextResponse.json(
      { error: "Inscription indisponible pour le moment." },
      { status: 503 },
    );
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from("waitlist")
    .upsert(
      { email, source: "landing" },
      // Idempotent : une adresse déjà inscrite ne déclenche ni erreur ni
      // doublon, et la réponse reste identique — on ne révèle donc pas si
      // l'adresse figurait déjà dans la liste.
      { onConflict: "email", ignoreDuplicates: true },
    );

  if (error) {
    console.error("waitlist: échec d'insertion", error.message);
    return NextResponse.json(
      { error: "Inscription impossible pour le moment." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
