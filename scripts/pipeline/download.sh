#!/usr/bin/env bash
# Télécharge tous les fichiers sources (géo + électoral) listés dans sources.json.
# Idempotent : ne re-télécharge pas un fichier déjà présent (utiliser --force pour forcer).
set -euo pipefail

cd "$(dirname "$0")/../.."

FORCE=0
if [[ "${1:-}" == "--force" ]]; then FORCE=1; fi

mkdir -p data/raw/geo data/raw/electoral data/raw/insee

fetch() {
  local url="$1" out="$2"
  if [[ -f "$out" && $FORCE -eq 0 ]]; then
    echo "skip $(basename "$out") (already present)"
    return
  fi
  echo "↓ $(basename "$out")"
  curl -L --fail --progress-bar -o "$out.part" "$url"
  mv "$out.part" "$out"
}

# Géo
for key in regions departements circonscriptions communes; do
  url=$(python3 -c "import json,sys;print(json.load(open('scripts/pipeline/sources.json'))['geo']['$key']['url'])")
  fetch "$url" "data/raw/geo/${key}.geojson"
done

# Électoral
for key in presidentielle_2017_t1 presidentielle_2017_t2 \
           presidentielle_2022_t1 presidentielle_2022_t2 \
           legislatives_2022_t1_bureau legislatives_2022_t1_circo \
           legislatives_2022_t2_bureau legislatives_2022_t2_circo \
           legislatives_2024_t1_bureau legislatives_2024_t2_bureau \
           legislatives_2024_t1_circo legislatives_2024_t2_circo \
           municipales_2026_t1_commune municipales_2026_t2_commune; do
  ext=$(python3 -c "import json;f=json.load(open('scripts/pipeline/sources.json'))['electoral']['$key']['format'];print('csv' if 'csv' in f else 'txt')")
  url=$(python3 -c "import json;print(json.load(open('scripts/pipeline/sources.json'))['electoral']['$key']['url'])")
  fetch "$url" "data/raw/electoral/${key}.${ext}"
done

# INSEE (Filosofi, …)
for key in filosofi_2021; do
  url=$(python3 -c "import json;print(json.load(open('scripts/pipeline/sources.json'))['insee']['$key']['url'])")
  fetch "$url" "data/raw/insee/${key}.zip"
  # Décompresse à côté si pas déjà fait.
  if [[ -f "data/raw/insee/${key}.zip" ]] && ! ls data/raw/insee/${key}*.csv >/dev/null 2>&1; then
    if ! unzip -o "data/raw/insee/${key}.zip" -d data/raw/insee/ >/dev/null; then
      echo "✗ unzip failed for $key.zip"
    fi
  fi
done

# INSEE — Recensement de la population (RP 2022, datasets melodi SDMX)
for ds in DS_RP_POPULATION_PRINC DS_RP_EMPLOI_LR_COMP DS_RP_DIPLOMES_PRINC; do
  fetch "https://api.insee.fr/melodi/file/${ds}/${ds}_2022_CSV_FR" "data/raw/insee/${ds}.zip"
  if [[ -f "data/raw/insee/${ds}.zip" ]] && ! ls "data/raw/insee/${ds}.d"/*.csv >/dev/null 2>&1; then
    mkdir -p "data/raw/insee/${ds}.d"
    unzip -o "data/raw/insee/${ds}.zip" -d "data/raw/insee/${ds}.d/" >/dev/null || echo "✗ unzip failed for ${ds}.zip"
  fi
done

echo
echo "✓ Sources téléchargées dans data/raw/"
ls -lh data/raw/geo data/raw/electoral data/raw/insee
