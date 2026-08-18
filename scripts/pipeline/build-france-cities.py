#!/usr/bin/env python3
"""
Génère public/france_cities.geojson : les points villes affichés sur la carte
(grandes villes, préfectures, sous-préfectures) avec 3 niveaux de zoom.

Source : API geo.api.gouv.fr (Étalab) — données INSEE / IGN, Licence Ouverte 2.0.

Classement (rank) aligné sur projetelections.onrender.com :
  rank 1  → 10 plus grandes villes de France (zoom 5+)
  rank 3  → préfectures de département (zoom 7+)
  rank 4  → sous-préfectures : villes > 20 000 hab hors préfectures (zoom 9+)

Sortie : GeoJSON FeatureCollection de Points avec properties { nom, rank, dept }.

Usage : python3 scripts/pipeline/build-france-cities.py
"""

from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
OUT_FILE = ROOT / "public" / "france_cities.geojson"

UA = {"User-Agent": "mouvancia-pipeline/1.0"}

COMMUNES_URL = (
    "https://geo.api.gouv.fr/communes"
    "?fields=nom,code,codeDepartement,population,centre"
    "&format=json&geometry=centre"
)
DEPARTEMENTS_URL = "https://geo.api.gouv.fr/departements?fields=nom,code,chefLieu"

# Les 10 plus grandes villes de France (population 2022, INSEE) — codes INSEE.
TOP10_CODES = {
    "75056",  # Paris
    "13055",  # Marseille
    "69123",  # Lyon
    "31555",  # Toulouse
    "06088",  # Nice
    "59350",  # Lille
    "34172",  # Montpellier
    "67482",  # Strasbourg
    "33063",  # Bordeaux
    "44109",  # Nantes
}

# Seuil de population pour rank 4 (sous-préfectures approximatives).
SOUS_PREF_POP_MIN = 20_000


def fetch_json(url: str):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main() -> None:
    print("→ récupération des communes et départements…")
    communes = fetch_json(COMMUNES_URL)
    departements = fetch_json(DEPARTEMENTS_URL)
    print(f"  {len(communes)} communes, {len(departements)} départements")

    chef_lieux = {d["chefLieu"] for d in departements if d.get("chefLieu")}

    features: list[dict] = []
    n_rank1 = n_rank3 = n_rank4 = 0

    for c in communes:
        code = c.get("code", "")
        nom = c.get("nom", "")
        dept = c.get("codeDepartement", "")
        pop = c.get("population") or 0
        centre = c.get("centre") or {}
        coords = centre.get("coordinates")
        if not coords or not nom:
            continue

        if code in TOP10_CODES:
            rank = 1
        elif code in chef_lieux:
            rank = 3
        elif pop >= SOUS_PREF_POP_MIN:
            rank = 4
        else:
            continue

        features.append(
            {
                "type": "Feature",
                "properties": {"nom": nom, "rank": rank, "dept": dept},
                "geometry": {"type": "Point", "coordinates": coords},
            }
        )
        if rank == 1:
            n_rank1 += 1
        elif rank == 3:
            n_rank3 += 1
        else:
            n_rank4 += 1

    out = {"type": "FeatureCollection", "features": features}
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)

    size_kb = OUT_FILE.stat().st_size // 1024
    print(f"✓ {OUT_FILE.relative_to(ROOT)}  ({size_kb} ko)")
    print(f"  rank 1 (grandes villes) : {n_rank1}")
    print(f"  rank 3 (préfectures)    : {n_rank3}")
    print(f"  rank 4 (sous-préf.)     : {n_rank4}")


if __name__ == "__main__":
    main()
