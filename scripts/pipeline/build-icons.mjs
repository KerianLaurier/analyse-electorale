// Rasterise l'identité (public/icon.svg) en icônes PWA committées :
//
//   node scripts/pipeline/build-icons.mjs
//
// - icon-192.png / icon-512.png : icône classique (coins arrondis inclus) ;
// - maskable-512.png : plein cadre avec ~22 % de marge de sûreté (le masque
//   de l'OS — cercle, squircle… — peut rogner jusqu'à 10 % de chaque bord).
//
// À relancer uniquement si l'identité change ; les PNG sont versionnés.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..", "..");
const SRC = path.join(ROOT, "public", "icon.svg");
const OUT = path.join(ROOT, "public", "icons");

// Marque « M » + socle chaud (reprise de public/icon.svg / apple-icon.tsx).
const MARK =
  "<path d='M3 17 L3 3 L7 3 L12 10 L17 3 L21 3 L21 17 L17 17 L17 8.25 L12 14.38 L7 8.25 L7 17 Z' fill='#fafaf8'/>" +
  "<rect x='3' y='19.2' width='18' height='2.2' rx='1.1' fill='#f0a020'/>";

// Plein cadre (pas de coins arrondis : c'est l'OS qui masque), marque à ~56 %.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#0a0a0c"/>
  <g transform="translate(113,110) scale(11.9)">${MARK}</g>
</svg>`;

await mkdir(OUT, { recursive: true });

for (const size of [192, 512]) {
  const png = await sharp(SRC, { density: 300 }).resize(size, size).png().toBuffer();
  await writeFile(path.join(OUT, `icon-${size}.png`), png);
  console.log(`✚ icons/icon-${size}.png (${png.length} o)`);
}

const maskable = await sharp(Buffer.from(MASKABLE_SVG), { density: 300 }).resize(512, 512).png().toBuffer();
await writeFile(path.join(OUT, "maskable-512.png"), maskable);
console.log(`✚ icons/maskable-512.png (${maskable.length} o)`);
