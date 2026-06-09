import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// Routes publiques (pas de compte requis) : landing + écrans d'authentification.
// /auth/team (réglages in-app) reste protégé.
const PUBLIC_PATHS = new Set([
  "/",
  "/auth/login",
  "/auth/signup",
  "/auth/abonnement",
  "/auth/forgot",
  "/auth/reset",
  // Ressources PWA (sans extension statique → sinon bloquées par le gating).
  "/manifest.webmanifest",
  "/apple-icon",
]);
function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

// Préfixes « applicatifs » : tout le reste (/, manifest, assets) = vitrine.
const APP_PREFIXES = [
  "/explorer",
  "/analyser",
  "/suivre",
  "/espace",
  "/circo",
  "/commune",
  "/bureau",
  "/candidat",
  "/elu",
  "/admin",
  "/auth",
  "/api",
];
function isAppPath(pathname: string): boolean {
  return APP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * Séparation vitrine / application par sous-domaine. Active **uniquement** si
 * `NEXT_PUBLIC_APP_URL` est défini (ex. `https://app.mouvancia.fr`) — sinon tout
 * reste sur un seul host (comportement local/dev inchangé).
 *
 * - sur `app.mouvancia.fr` : `/` → `/explorer`, le reste suit le gating normal ;
 * - sur le domaine racine (vitrine) : les routes applicatives sont renvoyées
 *   (308) vers le sous-domaine app ; les routes vitrine sont servies sans auth.
 *
 * Renvoie une réponse si la requête est gérée ici, sinon `null` (on poursuit).
 */
function routeBySubdomain(request: NextRequest): NextResponse | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) return null;

  let appHost: string;
  try {
    appHost = new URL(appUrl).host;
  } catch {
    return null;
  }
  const host = request.headers.get("host") ?? "";
  const { pathname, search } = request.nextUrl;

  // Domaine app : la racine renvoie vers l'entrée applicative, le reste suit.
  if (host === appHost) {
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/explorer";
      return NextResponse.redirect(url);
    }
    return null;
  }

  // Domaine racine (vitrine) : on déporte les routes applicatives vers l'app,
  // on sert les routes vitrine sans gating ni session.
  if (isAppPath(pathname)) {
    return NextResponse.redirect(`${appUrl.replace(/\/$/, "")}${pathname}${search}`, 308);
  }
  return NextResponse.next();
}

/**
 * Cache mémoire du gating par utilisateur : évite une requête `profiles` à
 * CHAQUE navigation (50-150 ms d'aller-retour). On ne met en cache que les
 * accès accordés — un refus (pas d'abonnement) est re-vérifié à chaque requête
 * pour que l'accès soit immédiat après souscription. Cache par isolat (perdu
 * au cold start, ce qui revient au comportement précédent).
 */
type GateEntry = { isSuperAdmin: boolean; expires: number };
const gateCache = new Map<string, GateEntry>();
const GATE_TTL_MS = 5 * 60_000;

/**
 * Gating d'accès : seules les personnes connectées disposant d'un abonnement
 * valide (actif ou essai en cours) accèdent à l'application.
 */
export async function proxy(request: NextRequest) {
  // Aiguillage vitrine / app par sous-domaine (no-op si NEXT_PUBLIC_APP_URL absent).
  const routed = routeBySubdomain(request);
  if (routed) return routed;

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

  const cached = gateCache.get(user.id);
  if (cached && cached.expires > Date.now()) {
    if ((pathname === "/admin" || pathname.startsWith("/admin/")) && !cached.isSuperAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/explorer";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Connecté → profil (abonnement + statut super-admin).
  const { data: profile } = await supabase
    .from("profiles")
    .select("subscription_status, trial_ends_at, is_super_admin")
    .eq("id", user.id)
    .single();

  const isSuperAdmin = profile?.is_super_admin === true;

  // Back-office : réservé aux super-admins.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (!isSuperAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/explorer";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // Le super-admin a toujours accès ; sinon abonnement actif ou essai en cours.
  const hasAccess =
    isSuperAdmin ||
    (!!profile &&
      (profile.subscription_status === "active" ||
        (profile.subscription_status === "trial" &&
          (!profile.trial_ends_at || new Date(profile.trial_ends_at as string) > new Date()))));

  if (hasAccess) {
    if (gateCache.size > 1000) gateCache.clear(); // borne mémoire, reconstruction lazy
    gateCache.set(user.id, { isSuperAdmin, expires: Date.now() + GATE_TTL_MS });
  }

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
