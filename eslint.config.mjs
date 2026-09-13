import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Bundles DuckDB-WASM copiés depuis node_modules (cf. scripts/copy-duckdb.mjs).
    "public/duckdb/**",
    // Modules MapLibre générés, déjà construits par leur éditeur.
    "public/maplibre/**",
  ]),
]);

export default eslintConfig;
