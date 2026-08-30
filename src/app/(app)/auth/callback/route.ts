import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Retour du lien de confirmation e-mail (et de tout flux PKCE) : échange le
 * `code` contre une session (cookies posés par le client serveur), puis
 * atterrissage sur `next` — par défaut la page d'accueil du parcours
 * (/bienvenue), cf. `emailRedirectTo` du signup.
 *
 * Si l'échange échoue (lien ouvert sur un autre appareil que celui de
 * l'inscription : le code_verifier PKCE n'y existe pas, lien expiré, etc.),
 * on renvoie vers la connexion : le compte est confirmé, l'utilisateur se
 * connecte avec son mot de passe et reprend le parcours.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/bienvenue";
  // Cible locale uniquement (pas d'open redirect).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/bienvenue";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/auth/login?next=${encodeURIComponent(next)}`);
}
