import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const values = [
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
]
  .map((name) => ({ name, value: process.env[name] }))
  .filter(({ value }) => !!value);
if (!values.length)
  throw new Error(
    "Configurer au moins une valeur sentinelle avant ce contrôle",
  );

let files = 0;
const matches = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(filename);
    else if (entry.isFile()) {
      files++;
      const content = await readFile(filename);
      for (const { name, value } of values) {
        if (content.includes(Buffer.from(value)))
          matches.push(`${name}: ${path.relative(root, filename)}`);
      }
    }
  }
}
await scan(path.join(root, ".next"));
await scan(path.join(root, "public"));
if (matches.length) {
  // Les valeurs sensibles ne sont jamais imprimées.
  console.error(
    "Valeur serveur présente dans les artefacts :\n" + matches.join("\n"),
  );
  process.exitCode = 1;
} else
  console.log(
    `${files} fichiers contrôlés : aucune valeur serveur fournie n'est présente`,
  );
