import path from "node:path";
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Le cache persistant peut sérialiser les variables serveur du build.
  // Les fonctions lisent les secrets à l'exécution ; rien ne doit les conserver
  // dans un cache que l'hébergeur pourrait archiver avec les artefacts.
  experimental: {
    turbopackFileSystemCacheForBuild: false,
  },
  turbopack: {
    root: path.join(__dirname),
  },
  // En-têtes de sécurité de base (l'app ne doit jamais être embarquée en
  // iframe ; aucun capteur n'est utilisé).
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy-Report-Only",
            value:
              "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io https://*.maptiler.com https://*.basemaps.cartocdn.com; worker-src 'self' blob:; frame-src https://checkout.stripe.com https://js.stripe.com",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

// Sentry : upload des source maps au build quand SENTRY_AUTH_TOKEN est défini
// (Netlify prod) ; simple passthrough sinon. L'init runtime vit dans
// src/instrumentation.ts / src/instrumentation-client.ts.
export default withSentryConfig(nextConfig, {
  silent: true,
  disableLogger: true,
  widenClientFileUpload: false,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
