// Next.js doit servir les deux modules côte à côte, hors du graphe Turbopack.
// https://maplibre.org/maplibre-gl-js/docs/#installation
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const packagePath = require.resolve("maplibre-gl/package.json");
const { version } = JSON.parse(readFileSync(packagePath, "utf8"));
if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version))
  throw new Error("Version MapLibre invalide");
const root = fileURLToPath(new URL("../", import.meta.url));
const dest = path.join(root, "public", "maplibre", version);
mkdirSync(dest, { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])
  copyFileSync(
    path.join(path.dirname(packagePath), "dist", name),
    path.join(dest, name),
  );
console.log(`MapLibre ${version} : worker et module partagé prêts`);
