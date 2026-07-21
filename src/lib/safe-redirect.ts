/**
 * Valide une destination de redirection interne (paramètre `next` d'un lien de
 * connexion). N'accepte qu'un chemin absolu de l'application ; rejette toute
 * redirection ouverte vers un domaine tiers.
 *
 * Vecteurs bloqués :
 *  - `https://evil.com` (URL absolue) ;
 *  - `//evil.com` (protocol-relative) ;
 *  - `/\evil.com` (backslash normalisé en `/` par certains navigateurs).
 *
 * Renvoie `fallback` (défaut `/explorer`) si l'entrée n'est pas un chemin interne sûr.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/explorer"): string {
  if (raw && /^\/(?![/\\])/.test(raw)) return raw;
  return fallback;
}
