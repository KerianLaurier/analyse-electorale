import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { env } from "@/lib/env";

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
  const appUrl = env.APP_URL;
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
 *
 * N'est plus utilisé que comme REPLI : si le Custom Access Token Hook est actif
 * (cf. supabase/migrations/20260623_jwt_subscription_claims.sql), le gating est
 * lu directement depuis les claims du JWT — zéro requête DB, valable sur tous
 * les isolats. Le cache ne sert que pour les tokens antérieurs au hook.
 */
type GateEntry = { isSuperAdmin: boolean; expires: number };
const gateCache = new Map<string, GateEntry>();
const GATE_TTL_MS = 5 * 60_000;

type ProxyClient = Awaited<ReturnType<typeof updateSession>>["supabase"];

/** Abonnement valide : actif, ou essai non expiré, ou super-admin. */
function computeAccess(
  status: string | null,
  trialEndsAt: string | null,
  isSuperAdmin: boolean,
): boolean {
  return (
    isSuperAdmin ||
    status === "active" ||
    (status === "trial" && (!trialEndsAt || new Date(trialEndsAt) > new Date()))
  );
}

/**
 * Lit le statut d'abonnement depuis les claims `app_metadata` du JWT
 * (`getClaims()` = vérification locale, pas de round-trip DB). Renvoie `null`
 * si les claims ne sont pas présents (hook non activé, token antérieur) ou en
 * cas d'erreur → le middleware retombe alors sur le cache + `profiles`.
 */
async function readSubscriptionClaims(supabase: ProxyClient): Promise<{
  subscriptionStatus: string;
  trialEndsAt: string | null;
  isSuperAdmin: boolean;
} | null> {
  try {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims as Record<string, unknown> | undefined;
    const meta = claims?.app_metadata as Record<string, unknown> | undefined;
    if (meta && typeof meta.subscription_status === "string") {
      return {
        subscriptionStatus: meta.subscription_status,
        trialEndsAt: typeof meta.trial_ends_at === "string" ? meta.trial_ends_at : null,
        isSuperAdmin: meta.is_super_admin === true,
      };
    }
  } catch {
    // claims indisponibles → repli
  }
  return null;
}

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

  // Fast path : claims JWT (zéro requête DB, valable sur tous les isolats).
  let isSuperAdmin: boolean;
  let hasAccess: boolean;

  const claims = await readSubscriptionClaims(supabase);
  if (claims) {
    isSuperAdmin = claims.isSuperAdmin;
    hasAccess = computeAccess(claims.subscriptionStatus, claims.trialEndsAt, isSuperAdmin);
  } else {
    // Repli (hook non activé / token antérieur) : cache mémoire puis `profiles`.
    const cached = gateCache.get(user.id);
    if (cached && cached.expires > Date.now()) {
      isSuperAdmin = cached.isSuperAdmin;
      hasAccess = true; // seuls les accès accordés sont mis en cache
    } else {
      const { data: profile } = await supabase
        .from("profiles")
        .select("subscription_status, trial_ends_at, is_super_admin")
        .eq("id", user.id)
        .single();
      isSuperAdmin = profile?.is_super_admin === true;
      hasAccess = computeAccess(
        (profile?.subscription_status as string | null) ?? null,
        (profile?.trial_ends_at as string | null) ?? null,
        isSuperAdmin,
      );
      if (hasAccess) {
        if (gateCache.size > 1000) gateCache.clear(); // borne mémoire, reconstruction lazy
        gateCache.set(user.id, { isSuperAdmin, expires: Date.now() + GATE_TTL_MS });
      }
    }
  }

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
