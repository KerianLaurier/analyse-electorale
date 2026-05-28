#!/usr/bin/env python3
"""
Construit les Parquet sociologie INSEE.

Filosofi 2021 (commune) :
- input  : data/raw/insee/DS_FILOSOFI_CC_data.csv (format SDMX long, ~833k lignes)
- output : public/insee/filosofi_2021_commune.parquet (wide, 1 ligne par commune)

Indicateurs retenus pour v1 :
- MED_SL  : niveau de vie médian (€)
- PR_MD60 : taux de pauvreté (%, seuil 60 % de la médiane)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "insee"
OUT = ROOT / "public" / "insee"

FILOSOFI_SRC = RAW / "DS_FILOSOFI_CC_data.csv"
FILOSOFI_OUT = OUT / "filosofi_2021_commune.parquet"

MEASURES = ("MED_SL", "PR_MD60")


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ Le package `duckdb` est requis. pip3 install duckdb", file=sys.stderr)
        return 1

    if not FILOSOFI_SRC.exists():
        print(f"✗ source manquante : {FILOSOFI_SRC} (run download.sh)")
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    print(f"→ Filosofi 2021 ({FILOSOFI_SRC.stat().st_size / 1e6:.1f} MB → parquet)")

    in_list = ", ".join(f"'{m}'" for m in MEASURES)
    sql = f"""
    COPY (
      WITH src AS (
        SELECT
          GEO AS code,
          FILOSOFI_MEASURE AS measure,
          TRY_CAST(OBS_VALUE AS DOUBLE) AS value
        FROM read_csv(
          '{FILOSOFI_SRC.as_posix()}',
          sep=';',
          header=true,
          quote='"',
          all_varchar=false,
          ignore_errors=true
        )
        WHERE GEO_OBJECT = 'COM' AND FILOSOFI_MEASURE IN ({in_list})
          AND OBS_VALUE IS NOT NULL
      )
      PIVOT src
        ON measure
        USING any_value(value)
        GROUP BY code
    )
    TO '{FILOSOFI_OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
    """
    duckdb.sql(sql)

    # Stats rapides.
    n_rows, *_ = duckdb.sql(
        f"SELECT COUNT(*) FROM read_parquet('{FILOSOFI_OUT.as_posix()}')"
    ).fetchone()
    size_kb = FILOSOFI_OUT.stat().st_size / 1024
    print(f"  ✓ {n_rows} communes ({size_kb:.0f} KB) → {FILOSOFI_OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
