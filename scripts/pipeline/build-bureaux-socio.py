#!/usr/bin/env python3
"""
Profil socio-démographique par BUREAU DE VOTE (Palier 1 — croisement socio × BV).

Principe : le code d'un bureau de vote (`codeBureauVote`, ex. « 01011_0001 ») porte
le code commune INSEE sur ses 5 premiers caractères. On rattache donc à chaque
bureau la socio de SA COMMUNE (Filosofi revenus + RP démographie/CSP), déjà
ingérée en local. Aucune donnée externe supplémentaire n'est téléchargée.

Granularité : commune. Tous les bureaux d'une même commune partagent le même
profil. C'est exact pour les ~35 000 communes à 1–quelques bureaux ; en ville
(Paris/Lyon/Marseille…), l'IRIS (Palier 2) raffinera plus tard. La colonne
`socio_grain` documente ce niveau pour être transparent côté produit.

Univers des bureaux : l'union des bureaux présents dans les agrégats électoraux
(public/electoral/agg/*_bureaux_territoires.parquet) — c.-à-d. exactement ceux
qu'on sait afficher.

Sortie : public/insee/bureaux_socio.parquet
  code (BV) + les 10 colonnes alignées sur SOCIO_INDICATORS (src/lib/analysis.ts)
  + insee (commune) + socio_grain.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INSEE = ROOT / "public" / "insee"
AGG = ROOT / "public" / "electoral" / "agg"
OUT = INSEE / "bureaux_socio.parquet"

FILO_COLS = ["MED_SL", "PR_MD60", "IR_D9_D1_SL", "S_SOC_BEN_DI", "S_RET_PEN_DI"]
RP_COLS = ["part65plus", "tauxChomage", "partCadres", "partOuvriers", "partDiplomeSup"]


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    filo = (INSEE / "filosofi_2021_commune.parquet").as_posix()
    rp = (INSEE / "rp_2022_commune.parquet").as_posix()
    for p in (filo, rp):
        if not Path(p).exists():
            print(f"✗ source manquante : {p} (run build-insee.py / build-rp.py)", file=sys.stderr)
            return 1

    bv_glob = (AGG / "*_bureaux_territoires.parquet").as_posix()
    if not list(AGG.glob("*_bureaux_territoires.parquet")):
        print(f"✗ aucun agrégat bureau dans {AGG} (run build-aggregates.py)", file=sys.stderr)
        return 1

    con = duckdb.connect()
    filo_sel = ", ".join(f"f.{c}" for c in FILO_COLS)
    rp_sel = ", ".join(f"r.{c}" for c in RP_COLS)

    con.execute(
        f"""
        CREATE TABLE bv AS
        WITH bureaux AS (
            -- univers : tous les bureaux qu'on sait afficher (union des scrutins)
            SELECT DISTINCT code
            FROM read_parquet('{bv_glob}')
            WHERE maille = 'bureaux' AND code IS NOT NULL
        )
        SELECT
            b.code,
            substr(b.code, 1, 5) AS insee,
            {filo_sel},
            {rp_sel},
            'commune' AS socio_grain
        FROM bureaux b
        LEFT JOIN read_parquet('{filo}') f ON f.code = substr(b.code, 1, 5)
        LEFT JOIN read_parquet('{rp}')   r ON r.code = substr(b.code, 1, 5)
        ORDER BY b.code
        """
    )

    OUT.parent.mkdir(parents=True, exist_ok=True)
    # ZSTD : parquet compact, lisible par DuckDB-WASM en HTTP range.
    con.execute(f"COPY bv TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")

    # ── Rapport de couverture (validation poids/perf) ──────────────────────
    n_bv = con.execute("SELECT count(*) FROM bv").fetchone()[0]
    n_communes = con.execute("SELECT count(DISTINCT insee) FROM bv").fetchone()[0]
    n_no_socio = con.execute("SELECT count(*) FROM bv WHERE MED_SL IS NULL").fetchone()[0]
    size_kb = OUT.stat().st_size / 1024
    cov = 100 * (n_bv - n_no_socio) / n_bv if n_bv else 0
    print(f"  ✓ {OUT.relative_to(ROOT)}  ({size_kb:.0f} Ko)")
    print(f"    {n_bv:,} bureaux · {n_communes:,} communes · couverture socio {cov:.1f}% "
          f"({n_no_socio:,} sans socio — souvent communes fusionnées/outre-mer)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
