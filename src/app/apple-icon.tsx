import { ImageResponse } from "next/og";

// Icône « Ajouter à l'écran d'accueil » iOS (PNG généré par Next).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

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
        <div style={{ width: 72, height: 72, borderRadius: 18, background: "#fafaf8" }} />
      </div>
    ),
    { ...size },
  );
}
