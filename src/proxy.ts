import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Routes publiques (pas de compte requis) : landing + écrans d'authentification.
// /auth/team (réglages in-app) reste protégé.
const PUBLIC_PATHS = new Set(["/", "/auth/login", "/auth/signup", "/auth/abonnement"]);
function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

/**
 * Gating d'accès : seules les personnes connectées disposant d'un abonnement
 * valide (actif ou essai en cours) accèdent à l'application.
 */
export async function proxy(request: NextRequest) {
  const { supabase, response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return response;

  // Non connecté → page de connexion (en mémorisant la destination).
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Connecté → vérifie l'abonnement (actif, ou essai non expiré).
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at")
    .eq("id", user.id)
    .single();

  const hasAccess =
    !!profile &&
    (profile.subscription_status === "active" ||
      (profile.subscription_status === "trial" &&
        (!profile.trial_ends_at || new Date(profile.trial_ends_at as string) > new Date())));

  if (!hasAccess && pathname !== "/auth/abonnement") {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/abonnement";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Toutes les routes sauf les internals Next et les fichiers statiques / data
  // (open data ; gating au niveau application pour la performance).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:parquet|pmtiles|json|svg|png|jpg|jpeg|gif|webp|ico|woff2?|wasm)$).*)",
  ],
};
