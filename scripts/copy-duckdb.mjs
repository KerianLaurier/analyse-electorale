// Copie les bundles DuckDB-WASM de node_modules vers public/duckdb (gitignoré).
// Self-hosting : plus de dépendance à jsDelivr au runtime (point de défaillance
// tiers pour le cœur analytique) et cache CDN sous notre contrôle.
// Lancé automatiquement avant `dev` et `build` (cf. package.json pre-scripts).
import { copyFileSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "node_modules/@duckdb/duckdb-wasm/dist");
const out = path.join(root, "public/duckdb");

// Bundles mvp (compatibilité) + eh (exception handling, navigateurs modernes).
const FILES = [
  "duckdb-mvp.wasm",
  "duckdb-browser-mvp.worker.js",
  "duckdb-eh.wasm",
  "duckdb-browser-eh.worker.js",
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
for (const f of FILES) {
  copyFileSync(path.join(dist, f), path.join(out, f));
}
console.log(`duckdb-wasm → public/duckdb (${FILES.length} fichiers)`);
