import { ImageResponse } from "next/og";

// Icône « Ajouter à l'écran d'accueil » iOS (PNG généré par Next).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Marque : « M » plein (clair) + socle chaud, sur fond sombre.
const MARK =
  "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'>" +
  "<path d='M3 17 L3 3 L7 3 L12 10 L17 3 L21 3 L21 17 L17 17 L17 8.25 L12 14.38 L7 8.25 L7 17 Z' fill='#fafaf8'/>" +
  "<rect x='3' y='19.2' width='18' height='2.2' rx='1.1' fill='#f0a020'/></svg>";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0c",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img width={104} height={104} src={`data:image/svg+xml,${encodeURIComponent(MARK)}`} alt="" />
      </div>
    ),
    { ...size },
  );
}
