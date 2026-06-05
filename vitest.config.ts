import { defineConfig } from "vitest/config";

// Tests unitaires sur la logique pure (`src/lib/*.test.ts`). Environnement
// `node` : aucune cible ne touche au DOM. L'alias `@/*` du tsconfig est résolu
// nativement par Vite (`resolve.tsconfigPaths`).
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
