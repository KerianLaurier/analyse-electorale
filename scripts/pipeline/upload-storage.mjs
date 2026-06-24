#!/usr/bin/env node
// Upload des données statiques (Parquet, PMTiles, JSON pré-calculés) vers
// Supabase Storage, pour les sortir du dépôt git (cf. docs/object-store.md).
//
// Usage :
//   SUPABASE_URL=https://<proj>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service_role> \
//   [BUCKET=data] [DRY_RUN=1] [ONLY=sondages,suivi] \
//   node scripts/pipeline/upload-storage.mjs
//
// Idempotent (upsert). Le service_role contourne la RLS Storage — à n'utiliser
// QUE côté serveur/CI, jamais exposé au client.

import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const PUBLIC = join(ROOT, "public");

// Sous-dossiers/fichiers de `public/` qui constituent les DONNÉES (pas les
// assets d'app : icônes, landing…). Doit rester aligné avec `dataUrl()` côté app.
const DATA_DIRS = ["electoral", "tiles", "insee", "sondages", "an", "suivi", "parrainages"];
const DATA_FILES = ["search-index.json"];

const CONTENT_TYPES = {
  ".parquet": "application/vnd.apache.parquet",
  ".pmtiles": "application/octet-stream",
  ".json": "application/json",
};

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.BUCKET ?? "data";
const DRY_RUN = process.env.DRY_RUN === "1";
// Restreint l'upload à certains dossiers (ex. quotidien : ONLY=sondages,suivi).
const ONLY = (process.env.ONLY ?? "").split(",").map((s) => s.trim()).filter(Boolean);

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("✗ SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return; // dossier absent → ignoré
  }
  for (const name of entries) {
    const full = join(dir, name);
    const s = await stat(full);
    if (s.isDirectory()) yield* walk(full);
    else yield full;
  }
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (data) return;
  if (DRY_RUN) {
    console.log(`(dry-run) créerait le bucket public « ${BUCKET} »`);
    return;
  }
  const { error } = await supabase.storage.createBucket(BUCKET, { public: true });
  if (error) throw new Error(`createBucket: ${error.message}`);
  console.log(`✓ bucket « ${BUCKET} » créé (public)`);
}

async function collectFiles() {
  const dirs = ONLY.length ? DATA_DIRS.filter((d) => ONLY.includes(d)) : DATA_DIRS;
  const files = [];
  for (const d of dirs) {
    for await (const f of walk(join(PUBLIC, d))) files.push(f);
  }
  if (!ONLY.length) {
    for (const f of DATA_FILES) {
      try {
        await stat(join(PUBLIC, f));
        files.push(join(PUBLIC, f));
      } catch {
        /* fichier absent → ignoré */
      }
    }
  }
  return files;
}

async function main() {
  await ensureBucket();
  const files = await collectFiles();
  console.log(`${files.length} fichier(s) à uploader vers ${BUCKET}/…`);

  let done = 0;
  let bytes = 0;
  for (const full of files) {
    const key = relative(PUBLIC, full); // ex. "electoral/agg/x.parquet"
    const contentType = CONTENT_TYPES[extname(full)] ?? "application/octet-stream";
    const body = await readFile(full);
    bytes += body.length;
    if (DRY_RUN) {
      console.log(`(dry-run) ${key} (${contentType}, ${body.length} o)`);
      done++;
      continue;
    }
    // Retry : sur gros volumes (milliers de fichiers), Supabase Storage renvoie
    // parfois un 400/timeout transitoire en rafale. 3 tentatives + backoff.
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(key, body, { contentType, upsert: true });
      if (!error) {
        lastErr = null;
        break;
      }
      lastErr = error;
      if (attempt < 3) await new Promise((r) => setTimeout(r, 400 * attempt));
    }
    if (lastErr) {
      console.error(`✗ ${key}: ${lastErr.message}`);
      process.exitCode = 1;
    } else {
      done++;
      if (done % 10 === 0) console.log(`  … ${done}/${files.length}`);
    }
  }
  console.log(
    `✓ ${done}/${files.length} fichier(s) (${(bytes / 1e6).toFixed(1)} Mo)` +
      (DRY_RUN ? " [dry-run]" : ` → ${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
