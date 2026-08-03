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
//
// ZÉRO DÉPENDANCE : uniquement des modules natifs + `fetch` (global depuis
// Node 18). Ce script tapait auparavant l'API Storage via @supabase/supabase-js,
// ce qui obligeait les 5 workflows qui l'appellent à faire un `npm ci` complet
// (~790 paquets) pour trois requêtes HTTP. Un lock cassé coupait alors la
// synchro des données alors que leur collecte, elle, fonctionnait — c'est
// exactement ce qui s'est produit du 30/07 au 03/08. Garder ce fichier sans
// dépendance, c'est garder l'upload indépendant de l'état de node_modules.

import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const PUBLIC = join(ROOT, "public");

// Sous-dossiers/fichiers de `public/` qui constituent les DONNÉES (pas les
// assets d'app : icônes, landing…). Doit rester aligné avec `dataUrl()` côté app.
const DATA_DIRS = ["electoral", "tiles", "insee", "sondages", "an", "suivi", "parrainages"];
const DATA_FILES = ["search-index.json"];

// Cache HTTP (Cloudflare + navigateur). Les données quotidiennes (sondages,
// suivi, parrainages, veille) changent souvent → cache court. Le reste (agrégats
// électoraux, socio, tuiles, choroplèthes, détail) est quasi immuable → cache
// long, pour éviter les re-téléchargements au fil de la navigation quotidienne.
const DAILY_DIRS = ["sondages", "suivi", "parrainages"];
const CACHE_LONG = "86400"; // 24 h
const CACHE_SHORT = "3600"; // 1 h
const cacheControlFor = (key) =>
  DAILY_DIRS.includes(key.split("/")[0]) ? CACHE_SHORT : CACHE_LONG;

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

const API = `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1`;

// Le service_role sert à la fois d'apikey et de bearer, comme le fait
// supabase-js. Les deux en-têtes sont attendus par l'API Storage.
const authHeaders = () => ({
  apikey: SERVICE_ROLE,
  authorization: `Bearer ${SERVICE_ROLE}`,
});

// Remonte un message d'erreur lisible : l'API Storage répond en JSON
// ({ message } ou { error }), mais pas sur toutes les couches (un 502 de
// passerelle renvoie du HTML) — d'où le repli sur le texte brut.
async function storageError(res) {
  const raw = await res.text().catch(() => "");
  try {
    const j = JSON.parse(raw);
    return j.message ?? j.error ?? raw ?? `HTTP ${res.status}`;
  } catch {
    return raw.slice(0, 200) || `HTTP ${res.status}`;
  }
}

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
  const res = await fetch(`${API}/bucket/${encodeURIComponent(BUCKET)}`, {
    headers: authHeaders(),
  });
  if (res.ok) return;
  if (res.status !== 404) {
    throw new Error(`getBucket: ${await storageError(res)}`);
  }
  if (DRY_RUN) {
    console.log(`(dry-run) créerait le bucket public « ${BUCKET} »`);
    return;
  }
  const created = await fetch(`${API}/bucket`, {
    method: "POST",
    headers: { ...authHeaders(), "content-type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
  if (!created.ok) throw new Error(`createBucket: ${await storageError(created)}`);
  console.log(`✓ bucket « ${BUCKET} » créé (public)`);
}

// Upload d'un objet. `x-upsert` rend l'opération idempotente (ré-upload d'un
// fichier existant = remplacement), et `cache-control` doit être envoyé sous
// forme `max-age=<s>` : supabase-js faisait cette conversion, pas l'API.
async function uploadObject(key, body, contentType, cacheControl) {
  const path = key.split("/").map(encodeURIComponent).join("/");
  return fetch(`${API}/object/${encodeURIComponent(BUCKET)}/${path}`, {
    method: "POST",
    headers: {
      ...authHeaders(),
      "content-type": contentType,
      "cache-control": `max-age=${cacheControl}`,
      "x-upsert": "true",
    },
    body,
  });
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
    const cacheControl = cacheControlFor(key);
    const body = await readFile(full);
    bytes += body.length;
    if (DRY_RUN) {
      console.log(`(dry-run) ${key} (${contentType}, cache ${cacheControl}s, ${body.length} o)`);
      done++;
      continue;
    }
    // Retry : sur gros volumes (milliers de fichiers), Supabase Storage renvoie
    // parfois un 400/timeout transitoire en rafale. 3 tentatives + backoff.
    let lastErr = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await uploadObject(key, body, contentType, cacheControl);
        if (res.ok) {
          lastErr = null;
          break;
        }
        lastErr = new Error(await storageError(res));
      } catch (err) {
        // Coupure réseau/DNS : fetch rejette au lieu de répondre. Même
        // traitement que les erreurs HTTP, pour ne pas perdre le retry.
        lastErr = err;
      }
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
