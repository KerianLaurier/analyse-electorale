#!/usr/bin/env python3
"""
Structure des familles & ménages par commune (Palier 3 — profondeur thématique).
Familles monoparentales et personnes seules sont de forts marqueurs sociaux.

Source : base INSEE « Couples - Familles - Ménages 2022 » au niveau IRIS
(base-ic-…, couverture nationale). On agrège à la commune via la colonne COM
(somme des effectifs IRIS), puis on dérive 2 indicateurs (%) :

  partFamMono         = familles monoparentales / total familles
  partPersonnesSeules = ménages d'une personne / total ménages

Sortie : public/insee/famille_2022_commune.parquet  (code + 2 colonnes, %)
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "insee"
OUT = ROOT / "public" / "insee" / "famille_2022_commune.parquet"


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    hits = [f for f in glob.glob(str(RAW / "famille.d" / "*")) if f.lower().endswith(".csv") and "meta" not in f.lower()]
    if not hits:
        print("✗ base couples-familles-ménages manquante dans data/raw/insee/famille.d (run download.sh)", file=sys.stderr)
        return 1
    src = hits[0]

    con = duckdb.connect()
    n = lambda c: f"TRY_CAST({c} AS DOUBLE)"  # noqa: E731
    con.execute(
        f"""
        CREATE TABLE fam AS
        WITH agg AS (
          SELECT COM AS code,
                 sum({n('C22_MEN')})       AS men,
                 sum({n('C22_MENPSEUL')})  AS menpseul,
                 sum({n('C22_FAM')})       AS fam,
                 sum({n('C22_FAMMONO')})   AS fammono
          FROM read_csv('{src}', sep=';', header=true, all_varchar=true, ignore_errors=true)
          WHERE length(COM) = 5
          GROUP BY COM
        )
        SELECT code,
          round(100.0 * fammono / NULLIF(fam, 0), 1)      AS partFamMono,
          round(100.0 * menpseul / NULLIF(men, 0), 1)     AS partPersonnesSeules
        FROM agg
        WHERE men > 0
        ORDER BY code
        """
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY fam TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    nrows = con.execute("SELECT count(*) FROM fam").fetchone()[0]
    avg = con.execute("SELECT avg(partFamMono), avg(partPersonnesSeules) FROM fam").fetchone()
    print(f"  ✓ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size/1024:.0f} Ko, {nrows:,} communes)")
    print(f"    moy. monoparentales {avg[0]:.1f}% · personnes seules {avg[1]:.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
