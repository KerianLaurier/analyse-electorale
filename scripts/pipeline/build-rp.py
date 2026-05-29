#!/usr/bin/env python3
"""
Démographie communale — Recensement de la population (INSEE RP 2022).

Source : api.insee.fr/melodi (datasets SDMX RP 2022, format CSV long), via
download.sh. On extrait des indicateurs socio-démographiques pertinents pour
l'analyse électorale, calculés par commune :

  population    : population municipale (POP, AGE=_T)
  part65plus    : part des 65 ans et + (%)
  partMoins15   : part des moins de 15 ans (%)
  tauxChomage   : chômeurs / actifs 15-64 (%)
  partCadres    : cadres parmi les actifs occupés (%)
  partOuvriers  : ouvriers parmi les actifs occupés (%)
  partDiplomeSup: part de diplômés du supérieur chez les 15 ans et + (%)

Sortie : public/insee/rp_2022_commune.parquet
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "insee"
OUT = ROOT / "public" / "insee" / "rp_2022_commune.parquet"


def data_csv(ds: str) -> str | None:
    hits = glob.glob(str(RAW / f"{ds}.d" / "*_data.csv"))
    return hits[0] if hits else None


def num(expr: str) -> str:
    return f"TRY_CAST({expr} AS DOUBLE)"


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    pop = data_csv("DS_RP_POPULATION_PRINC")
    emp = data_csv("DS_RP_EMPLOI_LR_COMP")
    dip = data_csv("DS_RP_DIPLOMES_PRINC")
    if not (pop and emp and dip):
        print("✗ sources RP manquantes dans data/raw/insee (run download.sh)")
        return 1

    con = duckdb.connect()
    con.execute("PRAGMA threads=4;")

    rd = lambda p: (  # noqa: E731
        f"read_csv('{p}', sep=';', header=true, all_varchar=true, ignore_errors=true)"
    )

    sql = f"""
    COPY (
      WITH pop AS (
        SELECT GEO AS code,
          SUM(CASE WHEN AGE='_T'     AND SEX='_T' THEN {num('OBS_VALUE')} END) AS population,
          SUM(CASE WHEN AGE='Y_GE65' AND SEX='_T' THEN {num('OBS_VALUE')} END) AS pop65,
          SUM(CASE WHEN AGE='Y_LT15' AND SEX='_T' THEN {num('OBS_VALUE')} END) AS pop_lt15
        FROM {rd(pop)} WHERE GEO_OBJECT='COM' AND RP_MEASURE='POP' AND TIME_PERIOD='2022' GROUP BY GEO
      ),
      emp AS (
        SELECT GEO AS code,
          SUM(CASE WHEN EMPSTA_ENQ='1T2' AND PCS='_T' THEN {num('OBS_VALUE')} END) AS actifs,
          SUM(CASE WHEN EMPSTA_ENQ='1'   AND PCS='_T' THEN {num('OBS_VALUE')} END) AS emploi,
          SUM(CASE WHEN EMPSTA_ENQ='1'   AND PCS='3'  THEN {num('OBS_VALUE')} END) AS cadres,
          SUM(CASE WHEN EMPSTA_ENQ='1'   AND PCS='6'  THEN {num('OBS_VALUE')} END) AS ouvriers
        FROM {rd(emp)} WHERE GEO_OBJECT='COM' AND RP_MEASURE='POP' AND TIME_PERIOD='2022' GROUP BY GEO
      ),
      dip AS (
        SELECT GEO AS code,
          SUM(CASE WHEN EDUC='_T' AND SEX='_T' THEN {num('OBS_VALUE')} END) AS pop15,
          SUM(CASE WHEN EDUC IN ('500_RP','600_RP','700_RP') AND SEX='_T' THEN {num('OBS_VALUE')} END) AS sup
        FROM {rd(dip)} WHERE GEO_OBJECT='COM' AND RP_MEASURE='POP' AND TIME_PERIOD='2022' GROUP BY GEO
      )
      SELECT
        pop.code,
        round(pop.population)                                              AS population,
        round(100.0 * pop.pop65    / nullif(pop.population, 0), 1)         AS part65plus,
        round(100.0 * pop.pop_lt15 / nullif(pop.population, 0), 1)         AS partMoins15,
        round(100.0 * (emp.actifs - emp.emploi) / nullif(emp.actifs, 0), 1) AS tauxChomage,
        round(100.0 * emp.cadres   / nullif(emp.emploi, 0), 1)            AS partCadres,
        round(100.0 * emp.ouvriers / nullif(emp.emploi, 0), 1)           AS partOuvriers,
        round(100.0 * dip.sup      / nullif(dip.pop15, 0), 1)            AS partDiplomeSup
      FROM pop
      LEFT JOIN emp USING (code)
      LEFT JOIN dip USING (code)
      WHERE pop.population IS NOT NULL
    ) TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
    """
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con.execute(sql)
    n = con.execute(f"SELECT COUNT(*) FROM read_parquet('{OUT.as_posix()}')").fetchone()[0]
    kb = OUT.stat().st_size / 1024
    print(f"✓ {n} communes → {OUT.relative_to(ROOT)} ({kb:.0f} Ko)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
