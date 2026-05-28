#!/usr/bin/env python3
"""
Construit l'index de recherche territoriale à partir des GeoJSON bruts.
Sortie : public/search-index.json — consommé côté client par la palette Cmd+K.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "geo"
OUT = ROOT / "public" / "search-index.json"


def load(name: str) -> list[dict]:
    path = RAW / f"{name}.geojson"
    if not path.exists():
        print(f"✗ source manquante : {path}")
        return []
    data = json.loads(path.read_text())
    return data.get("features", [])


def main() -> int:
    entries: list[dict] = []

    # Régions
    for f in load("regions"):
        p = f["properties"]
        entries.append(
            {"type": "region", "code": p.get("code"), "nom": p.get("nom")}
        )

    # Départements
    for f in load("departements"):
        p = f["properties"]
        entries.append(
            {"type": "departement", "code": p.get("code"), "nom": p.get("nom")}
        )

    # Circonscriptions législatives
    for f in load("circonscriptions"):
        p = f["properties"]
        entries.append(
            {
                "type": "circo",
                "code": p.get("codeCirconscription"),
                "nom": p.get("nomCirconscription"),
                "departement": p.get("nomDepartement"),
                "codeDepartement": p.get("codeDepartement"),
            }
        )

    # Communes
    for f in load("communes"):
        p = f["properties"]
        code = p.get("code")
        # Le code département est les 2 premiers caractères de l'INSEE pour
        # la métropole (les DOM ont un préfixe 97 + 1 chiffre, mais ça reste
        # exploitable pour la recherche).
        dep_code = code[:2] if code else None
        entries.append(
            {
                "type": "commune",
                "code": code,
                "nom": p.get("nom"),
                "codeDepartement": dep_code,
            }
        )

    # Garde-fou : on supprime les entries avec code/nom manquants.
    entries = [
        e for e in entries
        if e.get("code") and e.get("nom")
    ]

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(entries, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"✓ {len(entries)} entries → {OUT.relative_to(ROOT)} ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
