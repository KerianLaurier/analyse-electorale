import path from "node:path";
import { defineConfig } from "vitest/config";

// Tests unitaires sur la logique pure (`src/lib/*.test.ts`). Environnement
// `node` : aucune cible ne touche au DOM. L'alias `@/*` du tsconfig est résolu
// nativement par Vite (`resolve.tsconfigPaths`).
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": path.resolve(__dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
