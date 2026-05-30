"use client";

/**
 * Export CSV — utilitaire réutilisable (workspace).
 *
 * Séparateur « ; » + BOM UTF-8 pour une ouverture propre dans Excel FR.
 * `buildCsv` est une fonction pure (testable) ; `downloadCsv` déclenche le
 * téléchargement côté navigateur.
 */

export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = Record<string, CsvCell>;

const SEP = ";";

/** Échappe une cellule : guillemets si elle contient ; " ou un retour ligne. */
function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let s = typeof value === "number" ? String(value) : String(value);
  // Décimales à la française pour les nombres réels (lecture Excel FR).
  if (typeof value === "number" && !Number.isInteger(value)) {
    s = value.toLocaleString("fr-FR", { maximumFractionDigits: 4, useGrouping: false });
  }
  if (/[;"\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Construit le texte CSV. `columns` fixe l'ordre/sélection des colonnes ;
 * à défaut, les clés de la première ligne.
 */
export function buildCsv(rows: CsvRow[], columns?: string[]): string {
  if (rows.length === 0) return "";
  const cols = columns ?? Object.keys(rows[0]);
  const header = cols.map(escapeCell).join(SEP);
  const body = rows.map((r) => cols.map((c) => escapeCell(r[c])).join(SEP)).join("\r\n");
  return `${header}\r\n${body}`;
}

/** Nettoie une chaîne pour en faire un nom de fichier sûr. */
export function safeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "export";
}

/** Déclenche le téléchargement d'un CSV (BOM UTF-8 pour Excel). */
export function downloadCsv(filename: string, rows: CsvRow[], columns?: string[]): void {
  const csv = buildCsv(rows, columns);
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeFilename(filename)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Libère l'URL au tour de boucle suivant.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
