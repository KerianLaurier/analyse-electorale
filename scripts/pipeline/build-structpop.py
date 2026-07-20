#!/usr/bin/env python3
"""
Structure et dynamique de population par commune (lot 2 sociologie).
Trois indicateurs très discriminants électoralement :

  densite     = habitants / km²   (urbanité — comparateur : P22_POP / SUPERF)
  partJeunes  = 15-29 ans / population (%)   (evol-struct-pop : P22_POP1529)
  evoPop      = évolution de population 2016 → 2022 (%)   (P22_POP / P16_POP − 1)
                (croissance vs déclin démographique — « France qui se vide »)

Sources : bases CC « Comparateur de territoires » et « Évolution et structure
de la population 2022 » (via download.sh — URLs statiques insee.fr, PAS melodi).

Sortie : public/insee/structpop_2022_commune.parquet  (code + 3 colonnes)
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "insee"
OUT = ROOT / "public" / "insee" / "structpop_2022_commune.parquet"


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    cmp_hits = glob.glob(str(RAW / "comparateur.d" / "base_cc_comparateur.csv"))
    evo_hits = glob.glob(str(RAW / "evolpop.d" / "base-cc-evol-struct-pop-2022*.[cC][sS][vV]"))
    if not cmp_hits or not evo_hits:
        print("✗ comparateur/evolpop manquants dans data/raw/insee (run download.sh)", file=sys.stderr)
        return 1

    con = duckdb.connect()
    n = lambda c: f"TRY_CAST({c} AS DOUBLE)"  # noqa: E731
    con.execute(
        f"""
        CREATE TABLE structpop AS
        WITH cmp AS (
          SELECT CODGEO AS code, {n('P22_POP')} AS pop, {n('SUPERF')} AS superf
          FROM read_csv('{cmp_hits[0]}', sep=';', header=true, all_varchar=true, ignore_errors=true)
          WHERE length(CODGEO) = 5
        ),
        evo AS (
          SELECT CODGEO AS code, {n('P22_POP')} AS pop22,
                 {n('P22_POP1529')} AS jeunes, {n('P16_POP')} AS pop16
          FROM read_csv('{evo_hits[0]}', sep=';', header=true, all_varchar=true, ignore_errors=true)
          WHERE length(CODGEO) = 5
        )
        SELECT coalesce(cmp.code, evo.code) AS code,
          round(cmp.pop / NULLIF(cmp.superf, 0), 1)                    AS densite,
          round(100.0 * evo.jeunes / NULLIF(evo.pop22, 0), 1)          AS partJeunes,
          round(100.0 * (evo.pop22 / NULLIF(evo.pop16, 0) - 1.0), 1)   AS evoPop
        FROM cmp FULL OUTER JOIN evo USING (code)
        WHERE coalesce(cmp.pop, evo.pop22) > 0
        ORDER BY code
        """
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY structpop TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    n_rows = con.execute("SELECT count(*) FROM structpop").fetchone()[0]
    st = con.execute(
        "SELECT median(densite), avg(partJeunes), avg(evoPop) FROM structpop"
    ).fetchone()
    print(f"  ✓ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size/1024:.0f} Ko, {n_rows:,} communes)")
    print(f"    densité médiane {st[0]:.0f} hab/km² · jeunes moy. {st[1]:.1f}% · évol. pop moy. {st[2]:+.1f}%")
    return 0


if __name__ == "__main__":
    sys.exit(main())
