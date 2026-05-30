#!/usr/bin/env python3
"""
Table de correspondance commune → circonscription(s) législative(s).

Source : Ministère de l'Intérieur — « Table de correspondance des communes et
des cantons pour les élections législatives » (découpage 2010, stable de 2012
à 2024). data.gouv.fr, Licence Ouverte.

Une commune peut relever de plusieurs circonscriptions (grandes villes). On
produit la liste des circonscriptions par commune, avec le même code que les
agrégats électoraux : « dept(2) + circo(2) » (ex. 6901), commune INSEE 5 car.

Sortie : public/electoral/commune_circo.json
  { "01001": ["0104"], "69123": ["6901","6902","6903","6904"], ... }
"""
from __future__ import annotations

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "electoral"
SRC = RAW / "table_correspondance_circo.xlsx"
OUT = ROOT / "public" / "electoral" / "commune_circo.json"
URL = (
    "https://static.data.gouv.fr/resources/circonscriptions-legislatives-table-de-"
    "correspondance-des-communes-et-des-cantons-pour-les-elections-legislatives-de-"
    "2012-et-sa-mise-a-jour-pour-les-elections-legislatives-2017/20170411-141128/"
    "Table_de_correspondance_circo_legislatives2017-1.xlsx"
)


def dept2(code: str) -> str:
    code = str(code).strip()
    return code.zfill(2) if code.isdigit() else code


def main() -> int:
    try:
        import pandas as pd
    except ImportError:
        print("✗ pip3 install pandas openpyxl requis", file=sys.stderr)
        return 1

    if not SRC.exists():
        SRC.parent.mkdir(parents=True, exist_ok=True)
        print("→ Téléchargement de la table MinInt commune↔circo")
        try:
            req = urllib.request.Request(URL, headers={"User-Agent": "MOUVANCIA pipeline"})
            with urllib.request.urlopen(req, timeout=120) as r:
                SRC.write_bytes(r.read())
        except Exception as e:  # noqa: BLE001
            print(f"✗ téléchargement échoué : {e}", file=sys.stderr)
            return 1

    df = pd.read_excel(SRC)
    df.columns = [c.strip() for c in df.columns]

    mapping: dict[str, set[str]] = {}
    for _, row in df.iterrows():
        d = dept2(row["CODE DPT"])
        try:
            com = str(int(row["CODE COMMUNE"])).zfill(3)
            circ = str(int(row["CODE CIRC LEGISLATIVE"])).zfill(2)
        except (ValueError, TypeError):
            continue
        insee = f"{d}{com}"
        mapping.setdefault(insee, set()).add(f"{d}{circ}")

    out = {k: sorted(v) for k, v in sorted(mapping.items())}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    multi = sum(1 for v in out.values() if len(v) > 1)
    kb = OUT.stat().st_size / 1024
    print(f"✓ {len(out)} communes ({multi} multi-circo) → {OUT.relative_to(ROOT)} ({kb:.0f} Ko)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
