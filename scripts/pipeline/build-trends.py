#!/usr/bin/env python3
"""
Dynamiques électorales (Palier 5) — métriques DÉRIVÉES calculées au build,
à partir de l'historique déjà présent. Aucune donnée externe.

Première paire comparable : présidentielle 1er tour 2017 → 2022 (même type de
scrutin, nuances harmonisées). Par territoire :
  - Δ abstention  = abstention 2022 − abstention 2017            (points, signé)
  - Δ bloc RN/ext. droite = part(exprimés) 2022 − 2017          (points, signé)

On sert le RÉSULTAT (le client ne calcule rien) : un parquet étroit par maille,
clé `code` alignée sur les tuiles (choroplèthe) et les fiches.

Sortie : public/electoral/trends/presid_2017_2022.parquet
  colonnes : maille, code, abst_2017, abst_2022, d_abstention,
             rn_2017, rn_2022, d_rn   (taux 0..1, deltas signés)
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGG = ROOT / "public" / "electoral" / "agg"
OUT = ROOT / "public" / "electoral" / "trends" / "presid_2017_2022.parquet"

# Bloc « RN / extrême droite » — aligné sur BLOCS (src/lib/analysis.ts).
RN_CODES = ("RN", "UXD", "REC", "EXD", "DSV", "DLF", "LRN", "LUXD", "LREC", "LEXD", "LDSV")


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    terr = lambda s: (AGG / f"{s}_territoires.parquet").as_posix()  # noqa: E731
    cand = lambda s: (AGG / f"{s}_candidats.parquet").as_posix()  # noqa: E731
    for s in ("presid-2017-t1", "presid-2022-t1"):
        for f in (terr(s), cand(s)):
            if not Path(f).exists():
                print(f"✗ source manquante : {f} (run build-aggregates.py)", file=sys.stderr)
                return 1

    rn_list = ", ".join(f"'{c}'" for c in RN_CODES)
    con = duckdb.connect()

    # Participation + part RN par (maille, code) pour une présidentielle.
    def metrics(scrutin: str, suffix: str) -> str:
        return f"""
        SELECT t.maille, t.code,
               t.abstentions / NULLIF(t.inscrits, 0)      AS abst_{suffix},
               COALESCE(r.rn_voix, 0) / NULLIF(t.exprimes, 0) AS rn_{suffix}
        FROM read_parquet('{terr(scrutin)}') t
        LEFT JOIN (
            SELECT maille, code, sum(voix) AS rn_voix
            FROM read_parquet('{cand(scrutin)}')
            WHERE nuance IN ({rn_list})
            GROUP BY maille, code
        ) r ON r.maille = t.maille AND r.code = t.code
        """

    con.execute(
        f"""
        CREATE TABLE trends AS
        SELECT a.maille, a.code,
               round(a.abst_2017, 4) AS abst_2017,
               round(b.abst_2022, 4) AS abst_2022,
               round(b.abst_2022 - a.abst_2017, 4) AS d_abstention,
               round(a.rn_2017, 4)   AS rn_2017,
               round(b.rn_2022, 4)   AS rn_2022,
               round(b.rn_2022 - a.rn_2017, 4) AS d_rn
        FROM ({metrics('presid-2017-t1', '2017')}) a
        JOIN ({metrics('presid-2022-t1', '2022')}) b
          ON a.maille = b.maille AND a.code = b.code
        WHERE a.abst_2017 IS NOT NULL AND b.abst_2022 IS NOT NULL
        ORDER BY a.maille, a.code
        """
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    con.execute(f"COPY trends TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    n = con.execute("SELECT count(*) FROM trends").fetchone()[0]
    size_kb = OUT.stat().st_size / 1024
    print(f"  ✓ {OUT.relative_to(ROOT)}  ({size_kb:.0f} Ko, {n:,} territoires)")
    # Repère national (maille commune, moyenne pondérée approx via communes) :
    for maille in ("regions", "departements", "circonscriptions", "communes"):
        row = con.execute(
            "SELECT count(*), avg(d_abstention), avg(d_rn) FROM trends WHERE maille = ?", [maille]
        ).fetchone()
        if row[0]:
            print(f"    {maille:16} {row[0]:>6,} · Δabst̄ {row[1]*100:+.1f} pts · ΔRN̄ {row[2]*100:+.1f} pts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
