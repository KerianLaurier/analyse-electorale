#!/usr/bin/env python3
"""
Indicateurs socio-démographiques agrégés à la maille CIRCONSCRIPTION.

Les données Filosofi (revenus) et RP (démographie) sont communales. On les
agrège au niveau circonscription via la table commune→circo
(public/electoral/commune_circo.json), en moyenne pondérée par la population
(RP 2022). Les communes relevant de plusieurs circonscriptions (grandes villes)
voient leur population répartie à parts égales entre leurs circonscriptions.

Sortie : public/insee/circo_socio.parquet
  code (circo) + colonnes alignées sur SOCIO_INDICATORS (src/lib/analysis.ts) :
  MED_SL, PR_MD60, IR_D9_D1_SL, S_SOC_BEN_DI, S_RET_PEN_DI,
  part65plus, tauxChomage, partCadres, partOuvriers, partDiplomeSup
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INSEE = ROOT / "public" / "insee"
MAP = ROOT / "public" / "electoral" / "commune_circo.json"
OUT = INSEE / "circo_socio.parquet"

# colonne → source ('filosofi' | 'rp'), aligné sur SOCIO_INDICATORS
COLS = {
    "MED_SL": "filosofi", "PR_MD60": "filosofi", "IR_D9_D1_SL": "filosofi",
    "S_SOC_BEN_DI": "filosofi", "S_RET_PEN_DI": "filosofi",
    "part65plus": "rp", "tauxChomage": "rp", "partCadres": "rp",
    "partOuvriers": "rp", "partDiplomeSup": "rp",
}


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1
    if not MAP.exists():
        print("✗ commune_circo.json manquant (run build-commune-circo.py)")
        return 1

    mapping = json.loads(MAP.read_text())
    # table longue (insee, circo, n_circos)
    rows = []
    for insee, circos in mapping.items():
        k = len(circos)
        for c in circos:
            rows.append((insee, c, k))

    con = duckdb.connect()
    con.execute("CREATE TABLE cc(insee VARCHAR, circo VARCHAR, k INTEGER)")
    con.executemany("INSERT INTO cc VALUES (?,?,?)", rows)

    filo = (INSEE / "filosofi_2021_commune.parquet").as_posix()
    rp = (INSEE / "rp_2022_commune.parquet").as_posix()

    sel = ", ".join(
        f"{'f' if src == 'filosofi' else 'rp'}.{c} AS {c}" for c, src in COLS.items()
    )
    # poids = population / nb circos de la commune
    wmean = ",\n".join(
        f"SUM(w * {c}) / nullif(SUM(CASE WHEN {c} IS NOT NULL THEN w END), 0) AS {c}"
        for c in COLS
    )
    sql = f"""
    COPY (
      WITH base AS (
        SELECT cc.circo AS code,
               CAST(rp.population AS DOUBLE) / cc.k AS w,
               {sel}
        FROM cc
        JOIN read_parquet('{rp}') rp ON rp.code = cc.insee
        LEFT JOIN read_parquet('{filo}') f ON f.code = cc.insee
        WHERE rp.population IS NOT NULL AND rp.population > 0
      )
      SELECT code, {wmean}
      FROM base GROUP BY code
    ) TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)
    """
    con.execute(sql)
    n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{OUT.as_posix()}')").fetchone()[0]
    kb = OUT.stat().st_size / 1024
    print(f"✓ {n} circonscriptions → {OUT.relative_to(ROOT)} ({kb:.0f} Ko)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
