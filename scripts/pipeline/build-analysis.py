#!/usr/bin/env python3
"""
Agrégats d'analyse figés (pages « analyser »), sans DuckDB-WASM.

Pour chaque scrutin électoral × maille, fige un agrégat PAR NUANCE (single-file,
toutes les mailles y compris communes dans UN fichier — contrairement au détail
shardé) tel qu'attendu par les hooks de src/lib/analysis.ts :

  public/electoral/analysis/{scrutin}_{maille}.json
    { "<code>": { "l": libellé, "e": exprimés, "v": votants, "i": inscrits,
                  "nu": { "<nuance>": voix } } }

Le client en dérive : participation (v/i), vainqueur (argmax nu), part d'un bloc
(somme des nuances du bloc / e), matrice circo×bloc. La marginalité (niveau
candidat) et la soirée (départements) réutilisent les fichiers `detail/`.

Source : les agrégats public/electoral/agg/*. À lancer après build-aggregates.py.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGG = ROOT / "public" / "electoral" / "agg"
OUT = ROOT / "public" / "electoral" / "analysis"

WITH_CIRCO = ["regions", "departements", "circonscriptions", "communes"]
NO_CIRCO = ["regions", "departements", "communes"]
SCRUTINS: dict[str, list[str]] = {
    "presid-2017-t1": WITH_CIRCO, "presid-2017-t2": WITH_CIRCO,
    "presid-2022-t1": WITH_CIRCO, "presid-2022-t2": WITH_CIRCO,
    "legis-2022-t1": WITH_CIRCO, "legis-2022-t2": WITH_CIRCO,
    "legis-2024-t1": WITH_CIRCO, "legis-2024-t2": WITH_CIRCO,
    "municipales-2026-t1": NO_CIRCO, "municipales-2026-t2": NO_CIRCO,
}


def build(con, scrutin: str, maille: str) -> int:
    terr_p = AGG / f"{scrutin}_territoires.parquet"
    cand_p = AGG / f"{scrutin}_candidats.parquet"
    if not terr_p.exists() or not cand_p.exists():
        return 0

    terr = con.execute(
        f"""SELECT code, any_value(libelle) AS libelle,
                   SUM(inscrits) AS ins, SUM(votants) AS vot, SUM(exprimes) AS exp
            FROM read_parquet('{terr_p.as_posix()}')
            WHERE maille = ? AND code IS NOT NULL GROUP BY code""",
        [maille],
    ).fetchall()
    if not terr:
        return 0

    cand = con.execute(
        f"""SELECT code, nuance, SUM(voix) AS voix
            FROM read_parquet('{cand_p.as_posix()}')
            WHERE maille = ? AND code IS NOT NULL AND nuance IS NOT NULL AND voix IS NOT NULL
            GROUP BY code, nuance""",
        [maille],
    ).fetchall()

    nu: dict[str, dict[str, int]] = defaultdict(dict)
    for code, nuance, voix in cand:
        nu[str(code)][str(nuance)] = int(voix or 0)

    entries = {
        str(code): {
            "l": lib, "e": int(exp or 0), "v": int(vot or 0), "i": int(ins or 0),
            "nu": nu.get(str(code), {}),
        }
        for code, lib, ins, vot, exp in terr
    }

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f"{scrutin}_{maille}.json").write_text(
        json.dumps(entries, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    print(f"  ✓ {scrutin}_{maille}: {len(entries)} territoires")
    return len(entries)


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    con = duckdb.connect()
    con.execute("PRAGMA threads=4;")
    OUT.mkdir(parents=True, exist_ok=True)

    total = 0
    for scrutin, mailles in SCRUTINS.items():
        for maille in mailles:
            total += build(con, scrutin, maille)
    print(f"\n✓ agrégats d'analyse figés dans public/electoral/analysis/ ({total} lignes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
