"use client";

/**
 * Synchronisation cookies de session ↔ navigation complète.
 *
 * L'écriture des cookies par le client @supabase/ssr est asynchrone après
 * signIn/signUp ET après refreshSession : naviguer trop tôt ferait lire au
 * middleware un cookie absent ou périmé (course observée sur appareils lents).
 */

/**
 * Valeur courante des cookies de session (chunks `-auth-token` concaténés).
 * Exclut le cookie PKCE `-auth-token-code-verifier`, posé AVANT la session
 * (faux positif : il ne prouve pas que la session est écrite).
 */
export function sessionCookieSnapshot(): string {
  return document.cookie
    .split("; ")
    .filter((c) => c.includes("-auth-token") && !c.includes("code-verifier"))
    .sort()
    .join("|");
}

/**
 * Attend l'écriture des cookies de session, avec repli au bout de ~1 s.
 * - Sans argument : attend leur PRÉSENCE (après signIn/signUp).
 * - Avec `previous` (snapshot pris avant l'opération) : attend leur
 *   RÉÉCRITURE (après refreshSession, où l'ancien cookie existe déjà).
 */
export async function waitForSessionCookie(previous?: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const current = sessionCookieSnapshot();
    if (previous === undefined ? current !== "" : current !== previous) return;
    await new Promise((r) => setTimeout(r, 25));
  }
}
