#!/usr/bin/env bash
# Convertit chaque GeoJSON en PMTiles via tippecanoe.
# Détail max : pas de simplification (-ad), drop-densest-as-needed désactivé.
set -euo pipefail

cd "$(dirname "$0")/../.."

if ! command -v tippecanoe >/dev/null; then
  echo "✗ tippecanoe introuvable. brew install tippecanoe"
  exit 1
fi
if ! command -v pmtiles >/dev/null; then
  echo "✗ pmtiles introuvable. brew install pmtiles"
  exit 1
fi

mkdir -p data/geo public/tiles

build() {
  local key="$1" layer="$2" minz="$3" maxz="$4"
  local src="data/raw/geo/${key}.geojson"
  local mbtiles="data/geo/${key}.mbtiles"
  local pmtiles="public/tiles/${key}.pmtiles"

  if [[ ! -f "$src" ]]; then
    echo "✗ source manquante: $src (run download.sh d'abord)"
    return 1
  fi

  echo "→ build $key ($minz-$maxz)"
  tippecanoe \
    --force \
    --no-feature-limit \
    --no-tile-size-limit \
    --no-tile-compression \
    --layer="$layer" \
    --minimum-zoom="$minz" \
    --maximum-zoom="$maxz" \
    --simplification=1 \
    --no-line-simplification \
    --read-parallel \
    --output="$mbtiles" \
    "$src"

  pmtiles convert "$mbtiles" "$pmtiles"
  rm "$mbtiles"

  echo "  ✓ $(du -h "$pmtiles" | cut -f1) → $pmtiles"
}

build regions          regions          0 8
build departements     departements     0 9
build circonscriptions circonscriptions 0 11
build communes         communes         6 13

echo
echo "✓ Tuiles produites dans public/tiles/"
ls -lh public/tiles
