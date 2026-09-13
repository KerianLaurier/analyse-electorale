import { rm } from "node:fs/promises";

// Purger aussi un cache restauré par l'hébergeur avant cette désactivation.
// Seuls ces répertoires générés sont visés, jamais les données de l'application.
for (const relative of [
  "../.next/cache/turbopack/",
  "../.netlify/.next/cache/turbopack/",
]) {
  await rm(new URL(relative, import.meta.url), {
    recursive: true,
    force: true,
  });
}
console.log("Caches de compilation Turbopack antérieurs supprimés");
