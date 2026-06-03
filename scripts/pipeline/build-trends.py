#!/usr/bin/env python3
"""
Dynamiques électorales (Palier 5) — métriques DÉRIVÉES calculées au build,
à partir de l'historique déjà présent. Aucune donnée externe.

Deux comparaisons de même nature (nuances harmonisées) :
  - Présidentielle 1er tour 2017 → 2022
  - Législatives    1er tour 2022 → 2024   (le bond du RN, pivot pour 2027)

Par territoire et par comparaison, deltas signés (taux 0..1, exprimés/inscrits) :
  - Δ abstention                = abstention(now) − abstention(then)
  - Δ bloc RN / extrême droite  = part exprimés(now) − (then)
  - Δ bloc gauche / NFP         = part exprimés(now) − (then)

On sert le RÉSULTAT (le client ne calcule rien) : un parquet étroit par
comparaison, clé `code` alignée sur les tuiles et les fiches.

Sorties : public/electoral/trends/{presid_2017_2022,legis_2022_2024}.parquet
  colonnes : maille, code,
             abst_then, abst_now, d_abstention,
             rn_then, rn_now, d_rn,
             gauche_then, gauche_now, d_gauche
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGG = ROOT / "public" / "electoral" / "agg"
OUTDIR = ROOT / "public" / "electoral" / "trends"

# Blocs alignés sur BLOCS (src/lib/analysis.ts).
RN_CODES = ("RN", "UXD", "REC", "EXD", "DSV", "DLF", "LRN", "LUXD", "LREC", "LEXD", "LDSV")
GAUCHE_CODES = ("EXG", "DXG", "COM", "FI", "SOC", "RDG", "DVG", "UG", "NUP",
                "LEXG", "LCOM", "LFI", "LSOC", "LRDG", "LDVG", "LUG")

# (nom de sortie, scrutin "then", scrutin "now")
COMPARISONS = [
    ("presid_2017_2022", "presid-2017-t1", "presid-2022-t1"),
    ("legis_2022_2024", "legis-2022-t1", "legis-2024-t1"),
]


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    terr = lambda s: (AGG / f"{s}_territoires.parquet").as_posix()  # noqa: E731
    cand = lambda s: (AGG / f"{s}_candidats.parquet").as_posix()  # noqa: E731
    rn_list = ", ".join(f"'{c}'" for c in RN_CODES)
    ga_list = ", ".join(f"'{c}'" for c in GAUCHE_CODES)
    OUTDIR.mkdir(parents=True, exist_ok=True)
    con = duckdb.connect()

    # Participation + parts de blocs par (maille, code) pour un scrutin.
    def metrics(scrutin: str, suf: str) -> str:
        return f"""
        SELECT t.maille, t.code,
               t.abstentions / NULLIF(t.inscrits, 0)         AS abst_{suf},
               COALESCE(b.rn, 0) / NULLIF(t.exprimes, 0)      AS rn_{suf},
               COALESCE(b.ga, 0) / NULLIF(t.exprimes, 0)      AS gauche_{suf}
        FROM read_parquet('{terr(scrutin)}') t
        LEFT JOIN (
            SELECT maille, code,
                   sum(CASE WHEN nuance IN ({rn_list}) THEN voix ELSE 0 END) AS rn,
                   sum(CASE WHEN nuance IN ({ga_list}) THEN voix ELSE 0 END) AS ga
            FROM read_parquet('{cand(scrutin)}')
            GROUP BY maille, code
        ) b ON b.maille = t.maille AND b.code = t.code
        """

    for name, then_s, now_s in COMPARISONS:
        for f in (terr(then_s), cand(then_s), terr(now_s), cand(now_s)):
            if not Path(f).exists():
                print(f"✗ source manquante : {f} (run build-aggregates.py)", file=sys.stderr)
                return 1

        out = OUTDIR / f"{name}.parquet"
        con.execute(
            f"""
            CREATE OR REPLACE TABLE trends AS
            SELECT a.maille, a.code,
                   round(a.abst_then, 4)   AS abst_then,
                   round(b.abst_now, 4)    AS abst_now,
                   round(b.abst_now - a.abst_then, 4)     AS d_abstention,
                   round(a.rn_then, 4)     AS rn_then,
                   round(b.rn_now, 4)      AS rn_now,
                   round(b.rn_now - a.rn_then, 4)         AS d_rn,
                   round(a.gauche_then, 4) AS gauche_then,
                   round(b.gauche_now, 4)  AS gauche_now,
                   round(b.gauche_now - a.gauche_then, 4) AS d_gauche
            FROM ({metrics(then_s, 'then')}) a
            JOIN ({metrics(now_s, 'now')}) b
              ON a.maille = b.maille AND a.code = b.code
            WHERE a.abst_then IS NOT NULL AND b.abst_now IS NOT NULL
            ORDER BY a.maille, a.code
            """
        )
        con.execute(f"COPY trends TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        n = con.execute("SELECT count(*) FROM trends").fetchone()[0]
        nat = con.execute(
            "SELECT avg(d_abstention), avg(d_rn), avg(d_gauche) FROM trends WHERE maille='circonscriptions'"
        ).fetchone()
        print(f"  ✓ {out.relative_to(ROOT)}  ({out.stat().st_size/1024:.0f} Ko, {n:,} territoires)")
        print(f"    circo moy. · Δabst {nat[0]*100:+.1f} · ΔRN {nat[1]*100:+.1f} · Δgauche {nat[2]*100:+.1f} pts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
