"use client";

import * as duckdb from "@duckdb/duckdb-wasm";

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function init(): Promise<duckdb.AsyncDuckDB> {
  // jsDelivr-hosted WASM + workers. Sufficient for dev and early production.
  // À remplacer par un bundle self-hosté + COI quand on activera les pthreads.
  const bundles = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(bundles);
  if (!bundle.mainWorker) {
    throw new Error("DuckDB-WASM: aucun worker disponible pour ce navigateur");
  }
  const worker = await duckdb.createWorker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return db;
}

export function getDuckDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = init();
  }
  return dbPromise;
}

/**
 * Exécute une requête DuckDB-WASM.
 *
 * Sécurité : les valeurs contrôlées par l'utilisateur (codes de territoire issus
 * de l'URL ou d'un clic carte, mailles) ne doivent JAMAIS être interpolées dans
 * `sql`. On les passe via `params` (placeholders `?`), liées par un prepared
 * statement — ce qui neutralise toute injection (apostrophe, sous-requête,
 * `read_parquet` arbitraire…). Seuls les chemins de Parquet dérivés d'enums
 * validés peuvent rester dans `sql`.
 */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const db = await getDuckDb();
  const conn = await db.connect();
  try {
    if (params.length === 0) {
      const result = await conn.query(sql);
      return result.toArray().map((row) => row.toJSON()) as T[];
    }
    const stmt = await conn.prepare(sql);
    try {
      const result = await stmt.query(...params);
      return result.toArray().map((row) => row.toJSON()) as T[];
    } finally {
      await stmt.close();
    }
  } finally {
    await conn.close();
  }
}

/**
 * Construit l'URL absolue d'un Parquet servi depuis /public/electoral.
 * DuckDB-WASM utilise httpfs pour streamer en HTTP range request.
 */
export function parquetUrl(filename: string): string {
  if (typeof window === "undefined") return `/electoral/${filename}`;
  return `${window.location.origin}/electoral/${filename}`;
}

/** Variante pour les Parquet sociologie (servis depuis /public/insee). */
export function inseeUrl(filename: string): string {
  if (typeof window === "undefined") return `/insee/${filename}`;
  return `${window.location.origin}/insee/${filename}`;
}
