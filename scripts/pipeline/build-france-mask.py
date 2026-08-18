#!/usr/bin/env python3
"""
Génère public/france_contour.geojson : le masque « monde moins France » et le
contour national utilisés par la carte pour n'afficher que la France.

Le GeoJSON produit contient exactement 2 features :
  1. { masque: true }   → MultiPolygon : bbox monde (-180..180, -90..90) privée
                          de l'union des polygones France. Rendu en fill blanc
                          opaque, il masque tous les pays voisins.
  2. { }                → MultiPolygon : contour de la France seule, pour
                          tracer la fine bordure grise autour du territoire.

Entrées : les GeoJSON de toutes les mailles déjà téléchargés par download.sh
(data/raw/geo/{regions,departements,communes}.geojson). On prend l'union de
TOUS les polygones — métropole + DROM — pour que le masque laisse apparaître
la France entière, y compris outre-mer.

Usage :
    python3 scripts/pipeline/build-france-mask.py

Prérequis : geojson (aucune dépendance externe : on manipule directement les
coordonnées GeoJSON en Python pur via shapely si dispo, sinon fallback simple).

Pour un résultat production-grade, shapely est requis (pip install shapely).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Shapely est une dépendance dure de ce script. On l'importe en haut pour que
# Pyright résolve les symboles ; le message d'erreur utilisateur reste géré
# dans main() si l'import échoue à l'exécution.
try:
    from shapely.geometry import box, mapping, shape
    from shapely.ops import unary_union

    _SHAPELY_OK = True
except ImportError:  # pragma: no cover — message d'erreur dans main()
    box = mapping = shape = unary_union = None  # type: ignore[assignment]
    _SHAPELY_OK = False

ROOT = Path(__file__).resolve().parent.parent.parent
SRC_DIR = ROOT / "data" / "raw" / "geo"
OUT_FILE = ROOT / "public" / "france_contour.geojson"


def fail(msg: str) -> None:
    print(f"✗ {msg}", file=sys.stderr)
    sys.exit(1)


def load_geojson(path: Path) -> dict:
    if not path.exists():
        fail(f"source manquante : {path} — lancez d'abord download.sh")
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    if not _SHAPELY_OK:
        fail(
            "shapely est requis : pip install shapely  "
            "(ou utilisez le venv de la pipeline)"
        )
    # Pyright : après le garde-fou ci-dessus, shapely est bien importé.
    assert shape is not None and unary_union is not None
    assert box is not None and mapping is not None

    print("→ chargement des contours France…")

    # On prend l'union des communes (granularité la plus fine) : c'est le contour
    # le plus précis. Les DROM sont inclus dans le GeoJSON communes de
    # france-geojson.gregoiredavid.fr.
    communes = load_geojson(SRC_DIR / "communes.geojson")

    geoms = []
    for feat in communes.get("features", []):
        g = feat.get("geometry")
        if not g:
            continue
        try:
            geoms.append(shape(g))
        except Exception as e:  # géométrie invalide : on skip
            print(f"  ⚠ géométrie invalide ignorée : {e}", file=sys.stderr)

    if not geoms:
        fail("aucune géométrie valide trouvée dans communes.geojson")

    print(f"  {len(geoms)} communes chargées, union en cours…")
    france = unary_union(geoms)

    # Monde entier moins la France → le masque
    monde = box(-180.0, -90.0, 180.0, 90.0)
    masque = monde.difference(france)

    # Simplification très légère pour réduire la taille du fichier (le masque
    # n'a pas besoin de la précision communale : 0.01° ≈ 1 km suffit).
    masque = masque.simplify(0.01, preserve_topology=True)
    france_light = france.simplify(0.005, preserve_topology=True)

    out = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": {"masque": True},
                "geometry": mapping(masque),
            },
            {
                "type": "Feature",
                "properties": {},
                "geometry": mapping(france_light),
            },
        ],
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)

    size_kb = OUT_FILE.stat().st_size // 1024
    print(f"✓ {OUT_FILE.relative_to(ROOT)}  ({size_kb} ko)")


if __name__ == "__main__":
    main()
