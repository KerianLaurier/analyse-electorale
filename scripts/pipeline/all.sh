#!/usr/bin/env bash
# Pipeline complet : download → tiles + parquet.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"

bash "$here/download.sh" "$@"
bash "$here/build-tiles.sh"
python3 "$here/build-parquet.py"
python3 "$here/build-aggregates.py"
python3 "$here/build-bureaux.py"
python3 "$here/build-personnes.py"
python3 "$here/build-deputes.py"
python3 "$here/build-deputes-activite.py"
python3 "$here/build-insee.py"
python3 "$here/build-rp.py"
python3 "$here/build-cncs-notices.py"
python3 "$here/build-an-votes.py"
python3 "$here/build-an-lois.py"
python3 "$here/build-agenda.py"
python3 "$here/build-veille.py"
python3 "$here/build-search-index.py"
