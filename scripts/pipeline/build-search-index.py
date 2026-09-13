#!/usr/bin/env python3
"""
Construit l'index de recherche territoriale à partir des GeoJSON bruts.
Sortie : public/search-index.json — consommé côté client par la palette Cmd+K.
"""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "geo"
OUT = ROOT / "public" / "search-index.json"


def load(name: str) -> list[dict]:
    path = RAW / f"{name}.geojson"
    if not path.exists():
        raise ValueError(f"Source requise manquante : {path}")
    data = json.loads(path.read_text(encoding="utf-8"))
    features = data.get("features") if isinstance(data, dict) else None
    if not isinstance(data, dict) or data.get("type") != "FeatureCollection" or not isinstance(features, list) or not features:
        raise ValueError(f"Collection GeoJSON vide ou invalide : {path}")
    if any(not isinstance(f, dict) or not isinstance(f.get("properties"), dict) for f in features):
        raise ValueError(f"Propriétés GeoJSON invalides : {path}")
    return features


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
        # Les départements d'outre-mer utilisent trois chiffres ; conserver
        # également les préfixes corses et les zéros des codes INSEE.
        dep_code = code[:3] if isinstance(code, str) and code.startswith(("97", "98")) else code[:2] if isinstance(code, str) else None
        entries.append(
            {
                "type": "commune",
                "code": code,
                "nom": p.get("nom"),
                "codeDepartement": dep_code,
            }
        )

    # Ne jamais remplacer une version complète par un résultat silencieusement
    # amputé. Les codes sont des chaînes : un nombre perdrait les zéros initiaux.
    seen: set[tuple[str, str]] = set()
    for entry in entries:
        if any(not isinstance(entry.get(key), str) or not entry[key].strip() for key in ("code", "nom")):
            raise ValueError("Code ou nom territorial manquant/invalide")
        key = (entry["type"], entry["code"])
        if key in seen:
            raise ValueError(f"Territoire dupliqué : {key}")
        seen.add(key)
    entries.sort(key=lambda entry: (entry["type"], entry["code"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=OUT.parent, delete=False) as stream:
            temporary = Path(stream.name)
            json.dump(entries, stream, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(OUT)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    size_kb = OUT.stat().st_size / 1024
    print(f"✓ {len(entries)} entries → {OUT.relative_to(ROOT)} ({size_kb:.0f} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
