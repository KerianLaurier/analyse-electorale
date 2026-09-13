/**
 * Validation centralisée des variables d'environnement publiques.
 *
 * Les `NEXT_PUBLIC_*` sont inlinées au build par Next (disponibles côté client
 * comme serveur). On échoue tôt et avec un message clair si une variable requise
 * manque, plutôt que de propager un `undefined` cryptique dans supabase-js (le
 * `!` non-null masquait le problème jusqu'à un crash réseau opaque).
 *
 * Important : on référence chaque `process.env.NEXT_PUBLIC_X` en toutes lettres
 * pour que la substitution statique de Next opère (elle remplace le littéral).
 */
function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Variable d'environnement manquante : ${name}. ` +
        `Définissez-la dans .env.local (dev) ou la configuration de déploiement.`,
    );
  }
  return value;
}

export const env = {
  /** URL du projet Supabase. Requise (auth + données utilisateur). */
  SUPABASE_URL: required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  ),
  /** Clé anon Supabase. Requise. La sécurité repose sur la RLS, pas sur le secret. */
  SUPABASE_ANON_KEY: required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  ),
  /**
   * Optionnelle : si définie (ex. `https://app.mouvancia.fr`), active le split
   * vitrine/app par sous-domaine. Absente en local/preview → host unique.
   */
  APP_URL: process.env.NEXT_PUBLIC_APP_URL || undefined,
} as const;
