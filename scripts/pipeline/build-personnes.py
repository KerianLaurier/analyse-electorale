#!/usr/bin/env python3
"""
Enrichissement nominatif des candidats (législatives 2024).

Les Parquet agrégés `agg/legis-2024-*_candidats.parquet` ne portent que le nom
de famille (label) + la nuance. Les Parquet « bureau de vote »
(`public/electoral/legislatives_2024_t{1,2}_bureau.parquet`, format MinInt large)
portent en revanche le nominatif complet : Nom, Prénom, Sexe, Nuance.

Ce script déplie les colonnes candidat des fichiers bureau et produit un index
JSON léger qui mappe une clé déterministe vers le prénom et le sexe, pour
enrichir les fiches /candidat/[id] et /elu/[id] côté client.

Clé : "{dept}__{slug(nom)}__{nuance}"
  dept   = code département sur 2 caractères ("01".."95","2A","2B","971"…)
  nom    = nom de famille normalisé (minuscules, sans accents, alphanumérique)
  nuance = code nuance MinInt (UG, RN, ENS…)

Sortie : public/electoral/personnes-2024.json
  { "<clé>": { "nom": str, "prenom": str|null, "sexe": "M"|"F"|null } }
"""
from __future__ import annotations

import json
import sys
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ELECTORAL = ROOT / "public" / "electoral"
OUT = ELECTORAL / "personnes-2024.json"

SOURCES = [
    ELECTORAL / "legislatives_2024_t1_bureau.parquet",
    ELECTORAL / "legislatives_2024_t2_bureau.parquet",
]


def slug(s: str) -> str:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    out = []
    for c in s:
        out.append(c if c.isalnum() else " ")
    return " ".join("".join(out).split())


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    con = duckdb.connect()
    rows: list[tuple] = []

    for src in SOURCES:
        if not src.exists():
            print(f"  ⚠ source manquante : {src.name}")
            continue
        cols = con.execute(
            f"DESCRIBE SELECT * FROM read_parquet('{src.as_posix()}')"
        ).df()["column_name"].tolist()
        ncand = sum(1 for c in cols if c.startswith("Nuance candidat "))
        unions = []
        for i in range(1, ncand + 1):
            unions.append(
                f"""
                SELECT
                  lpad("Code département", 2, '0') AS dept,
                  trim("Nom candidat {i}")    AS nom,
                  trim("Prénom candidat {i}") AS prenom,
                  upper(trim("Sexe candidat {i}")) AS sexe,
                  trim("Nuance candidat {i}") AS nuance
                FROM read_parquet('{src.as_posix()}')
                WHERE nullif(trim("Nom candidat {i}"), '') IS NOT NULL
                """
            )
        # On garde, par (dept, nom, nuance), le prénom/sexe le plus fréquent.
        sql = f"""
          WITH long AS ({' UNION ALL '.join(unions)}),
          ranked AS (
            SELECT dept, nom, nuance, prenom, sexe, COUNT(*) AS n,
                   ROW_NUMBER() OVER (
                     PARTITION BY dept, nom, nuance
                     ORDER BY COUNT(*) DESC
                   ) AS rn
            FROM long
            GROUP BY dept, nom, nuance, prenom, sexe
          )
          SELECT dept, nom, nuance, prenom, sexe FROM ranked WHERE rn = 1
        """
        rows.extend(con.execute(sql).fetchall())
        print(f"  ✓ {src.name} : {ncand} colonnes candidat")

    index: dict[str, dict] = {}
    for dept, nom, nuance, prenom, sexe in rows:
        if not dept or not nom or not nuance:
            continue
        key = f"{dept}__{slug(nom)}__{nuance}"
        # première occurrence gagne (T1 traité avant T2 ; champ plus complet)
        if key in index:
            continue
        s = (sexe or "")[:1]  # MASCULIN→M, FEMININ→F
        index[key] = {
            "nom": nom,
            "prenom": prenom or None,
            "sexe": s if s in ("M", "F") else None,
        }

    OUT.write_text(json.dumps(index, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"\n✓ {len(index)} personnes → {OUT.relative_to(ROOT)} ({size_kb:.0f} Ko)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
