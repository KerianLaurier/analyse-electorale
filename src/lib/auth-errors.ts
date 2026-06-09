/**
 * Traduction des erreurs Supabase Auth en messages français actionnables.
 * Supabase renvoie des messages techniques en anglais (« Invalid login
 * credentials ») : on mappe par `code` (stable, documenté) avec un repli
 * heuristique sur le message pour les erreurs sans code.
 */

const MESSAGES: Record<string, string> = {
  invalid_credentials: "E-mail ou mot de passe incorrect.",
  email_not_confirmed:
    "Votre adresse e-mail n'a pas encore été confirmée. Vérifiez votre boîte mail.",
  user_already_exists: "Un compte existe déjà avec cette adresse. Connectez-vous.",
  email_exists: "Un compte existe déjà avec cette adresse. Connectez-vous.",
  user_not_found: "Aucun compte ne correspond à cette adresse.",
  weak_password: "Mot de passe trop faible : utilisez au moins 8 caractères.",
  same_password: "Le nouveau mot de passe doit être différent de l'actuel.",
  email_address_invalid: "Cette adresse e-mail n'est pas valide.",
  over_request_rate_limit:
    "Trop de tentatives. Patientez quelques minutes avant de réessayer.",
  over_email_send_rate_limit:
    "Trop d'e-mails envoyés récemment. Patientez quelques minutes avant de réessayer.",
  signup_disabled: "Les inscriptions sont momentanément fermées.",
  session_expired: "Votre session a expiré. Reconnectez-vous.",
  refresh_token_not_found: "Votre session a expiré. Reconnectez-vous.",
  validation_failed: "Vérifiez les champs saisis puis réessayez.",
};

export function authErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string; status?: number } | null;
  if (e?.code && MESSAGES[e.code]) return MESSAGES[e.code];

  const msg = e?.message ?? "";
  if (/invalid login credentials/i.test(msg)) return MESSAGES.invalid_credentials;
  if (/email not confirmed/i.test(msg)) return MESSAGES.email_not_confirmed;
  if (/already registered|already exists/i.test(msg)) return MESSAGES.user_already_exists;
  if (/rate limit/i.test(msg)) return MESSAGES.over_request_rate_limit;
  if (/password/i.test(msg) && /short|weak|least/i.test(msg)) return MESSAGES.weak_password;
  if (/fetch|network/i.test(msg))
    return "Connexion impossible. Vérifiez votre réseau puis réessayez.";

  return "Une erreur est survenue. Réessayez dans un instant.";
}
