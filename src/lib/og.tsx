import { ImageResponse } from "next/og";

/**
 * Rendu partagé de l'image de partage social (Open Graph + Twitter), aux
 * couleurs de la marque. Généré au build via `next/og` (Satori). Utilisé par
 * `app/opengraph-image.tsx` et `app/twitter-image.tsx`.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_ALT =
  "MOUVANCIA — L'intelligence électorale, du national au bureau de vote";
export const OG_CONTENT_TYPE = "image/png";

const INK = "#14130f";
const PAPER = "#f4f3ef";
const WARM = "#dd971f";
const MUTED = "#6f6a5c";

export function ogImageResponse() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: PAPER,
          padding: "76px 88px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Marque */}
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 14,
              background: INK,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <div style={{ width: 22, height: 22, borderRadius: 5, background: PAPER }} />
            <div style={{ width: 22, height: 5, borderRadius: 99, background: WARM }} />
          </div>
          <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 8, color: INK }}>
            MOUVANCIA
          </div>
        </div>

        {/* Accroche */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, fontWeight: 600, color: WARM, letterSpacing: 1 }}>
            Analyse électorale &amp; pilotage de campagne
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 80,
              fontWeight: 800,
              color: INK,
              lineHeight: 1.04,
              letterSpacing: -2,
              marginTop: 22,
              maxWidth: 980,
            }}
          >
            L&apos;intelligence électorale, du national au bureau de vote.
          </div>
          <div style={{ width: 200, height: 9, borderRadius: 99, background: WARM, marginTop: 34 }} />
        </div>

        {/* Pied */}
        <div style={{ display: "flex", fontSize: 24, color: MUTED }}>
          mouvancia.fr · Ministère de l&apos;Intérieur · INSEE · Assemblée nationale · Commission des sondages
        </div>
      </div>
    ),
    { ...OG_SIZE },
  );
}
