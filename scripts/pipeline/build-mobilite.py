#!/usr/bin/env python3
"""
Mobilité résidentielle par commune (Palier 3 — profondeur thématique).
L'ancrage / le renouvellement de la population est un marqueur fort : les zones
à fort turnover (étudiants, nouveaux quartiers, périurbain dynamique) votent
différemment des territoires stables.

Source : base INSEE « Évolution et structure de la population 2022 »
(base-cc-evol-struct-pop, niveau commune). Indicateur de résidence antérieure
(IRAN) : IRAN1 = même logement qu'un an auparavant.

  partNouveauxArrivants = (POP 1 an+ − IRAN1) / POP 1 an+  = part ayant
                          emménagé dans l'année (changement de logement).

Sortie : public/insee/mobilite_2022_commune.parquet  (code + 1 colonne, %)
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "insee"
OUT = ROOT / "public" / "insee" / "mobilite_2022_commune.parquet"


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    hits = [f for f in glob.glob(str(RAW / "evolpop.d" / "*")) if f.lower().endswith(".csv") and "meta" not in f.lower()]
    if not hits:
        print("✗ base évol-struct-pop manquante dans data/raw/insee/evolpop.d (run download.sh)", file=sys.stderr)
        return 1
    src = hits[0]

    con = duckdb.connect()
    n = lambda c: f"TRY_CAST({c} AS DOUBLE)"  # noqa: E731
    con.execute(
        f"""
        CREATE TABLE mob AS
        SELECT CODGEO AS code,
          round(100.0 * ({n('P22_POP01P')} - {n('P22_POP01P_IRAN1')}) / NULLIF({n('P22_POP01P')}, 0), 1)
            AS partNouveauxArrivants
        FROM read_csv('{src}', sep=';', header=true, all_varchar=true, ignore_errors=true)
        WHERE length(CODGEO) = 5 AND {n('P22_POP01P')} > 0
        ORDER BY code
        """
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY mob TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    nrows = con.execute("SELECT count(*) FROM mob").fetchone()[0]
    stats = con.execute(
        "SELECT avg(partNouveauxArrivants), min(partNouveauxArrivants), max(partNouveauxArrivants) FROM mob WHERE partNouveauxArrivants IS NOT NULL"
    ).fetchone()
    print(f"  ✓ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size/1024:.0f} Ko, {nrows:,} communes)")
    print(f"    nouveaux arrivants — moy {stats[0]:.1f}% · min {stats[1]:.1f}% · max {stats[2]:.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
