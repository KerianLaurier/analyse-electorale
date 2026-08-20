// Rasterise l'identité (public/icon.svg) en icônes PWA committées :
//
//   node scripts/pipeline/build-icons.mjs
//
// - icon-192.png / icon-512.png : icône classique (coins arrondis inclus) ;
// - maskable-512.png : plein cadre avec ~22 % de marge de sûreté (le masque
//   de l'OS — cercle, squircle… — peut rogner jusqu'à 10 % de chaque bord) ;
// - src/app/favicon.ico : onglet du navigateur (16/32/48/256, PNG embarqués).
//
// À relancer uniquement si l'identité change ; les PNG sont versionnés.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.join(import.meta.dirname, "..", "..");
const SRC = path.join(ROOT, "public", "icon.svg");
const OUT = path.join(ROOT, "public", "icons");
const FAVICON = path.join(ROOT, "src", "app", "favicon.ico");

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

// ── favicon.ico ───────────────────────────────────────────────────────────────
// Next sert `src/app/favicon.ico` comme icône d'onglet. Un .ico n'est qu'un
// conteneur : on y embarque des PNG (accepté par tous les navigateurs actuels),
// ce qui évite d'encoder du BMP à la main.
const ICO_SIZES = [16, 32, 48, 256];
const tiles = await Promise.all(
  ICO_SIZES.map((size) =>
    sharp(SRC, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toBuffer(),
  ),
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // réservé
header.writeUInt16LE(1, 2); // type 1 = icône
header.writeUInt16LE(ICO_SIZES.length, 4);

let offset = 6 + ICO_SIZES.length * 16;
const entries = ICO_SIZES.map((size, i) => {
  const e = Buffer.alloc(16);
  const dim = size >= 256 ? 0 : size; // 0 code la taille 256
  e.writeUInt8(dim, 0);
  e.writeUInt8(dim, 1);
  e.writeUInt8(0, 2); // pas de palette
  e.writeUInt8(0, 3); // réservé
  e.writeUInt16LE(1, 4); // plans de couleur
  e.writeUInt16LE(32, 6); // bits par pixel
  e.writeUInt32LE(tiles[i].length, 8);
  e.writeUInt32LE(offset, 12);
  offset += tiles[i].length;
  return e;
});

const ico = Buffer.concat([header, ...entries, ...tiles]);
await writeFile(FAVICON, ico);
console.log(`✚ src/app/favicon.ico (${ICO_SIZES.join(", ")} px, ${ico.length} o)`);
