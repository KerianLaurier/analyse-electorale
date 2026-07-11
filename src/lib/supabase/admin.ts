import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase SERVICE ROLE — serveur uniquement (routes API, webhooks).
 * Bypasse la RLS : ne JAMAIS l'importer depuis un composant client, ne jamais
 * exposer `SUPABASE_SERVICE_ROLE_KEY` en NEXT_PUBLIC_*.
 *
 * Usage : écrire les colonnes d'abonnement que `authenticated` ne peut pas
 * modifier (stripe_customer_id, subscription_status…) depuis les webhooks
 * Stripe et la route de checkout.
 */

let cached: SupabaseClient | null = null;

export function serviceRoleConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (et NEXT_PUBLIC_SUPABASE_URL) requises côté serveur — " +
        "à définir dans l'environnement de déploiement (jamais en NEXT_PUBLIC_*).",
    );
  }
  if (!cached) {
    cached = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}
