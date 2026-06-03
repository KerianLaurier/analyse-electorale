#!/usr/bin/env python3
"""
Logement par commune (Palier 3 — profondeur thématique). Le statut résidentiel
(propriétaire / locataire) est l'un des meilleurs prédicteurs de vote.

Source : base « Comparateur de territoires » INSEE (millésime RP 2022), fichier
communal compact `base_cc_comparateur.csv` (via download.sh). On en dérive 4
indicateurs (%) par commune :

  partProprietaires   = RP occupées par propriétaires / résidences principales
  partLocataires      = (RP − propriétaires) / résidences principales
  partResSecondaires  = résidences secondaires / parc de logements
  partLogVacants      = logements vacants / parc de logements

Sortie : public/insee/logement_2022_commune.parquet  (code + 4 colonnes, %)
"""
from __future__ import annotations

import glob
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "insee"
OUT = ROOT / "public" / "insee" / "logement_2022_commune.parquet"


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    hits = glob.glob(str(RAW / "comparateur.d" / "base_cc_comparateur.csv"))
    if not hits:
        print("✗ base_cc_comparateur.csv manquant dans data/raw/insee/comparateur.d (run download.sh)", file=sys.stderr)
        return 1
    src = hits[0]

    con = duckdb.connect()
    n = lambda c: f"TRY_CAST({c} AS DOUBLE)"  # noqa: E731
    con.execute(
        f"""
        CREATE TABLE logt AS
        WITH b AS (
          SELECT CODGEO AS code,
                 {n('P22_LOG')} AS log, {n('P22_RP')} AS rp,
                 {n('P22_RSECOCC')} AS rsec, {n('P22_LOGVAC')} AS vac,
                 {n('P22_RP_PROP')} AS prop
          FROM read_csv('{src}', sep=';', header=true, all_varchar=true, ignore_errors=true)
          WHERE length(CODGEO) = 5
        )
        SELECT code,
          round(100.0 * prop / NULLIF(rp, 0), 1)            AS partProprietaires,
          round(100.0 * (rp - prop) / NULLIF(rp, 0), 1)     AS partLocataires,
          round(100.0 * rsec / NULLIF(log, 0), 1)           AS partResSecondaires,
          round(100.0 * vac / NULLIF(log, 0), 1)            AS partLogVacants
        FROM b
        WHERE rp IS NOT NULL AND rp > 0
        ORDER BY code
        """
    )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY logt TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    n_rows = con.execute("SELECT count(*) FROM logt").fetchone()[0]
    avg = con.execute("SELECT avg(partProprietaires), avg(partResSecondaires) FROM logt").fetchone()
    print(f"  ✓ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size/1024:.0f} Ko, {n_rows:,} communes)")
    print(f"    moy. propriétaires {avg[0]:.1f}% · résidences secondaires {avg[1]:.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
