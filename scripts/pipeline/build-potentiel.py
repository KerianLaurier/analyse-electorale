#!/usr/bin/env python3
"""
Indice de potentiel par bloc (Palier — analyse dérivée). TRANSPARENT et fondé
sur les données : pour chaque bloc politique, on apprend par régression (ridge)
le score qu'il « devrait » faire compte tenu du profil socio-démographique
local, puis on compare au réel.

  affinité  = score attendu vu le profil (RP 2022 + logement) — régression sur
              les communes (présidentielle 2022, 1er tour, hypothèse claire à
              5 blocs séparés).
  potentiel = affinité − réel :
                > 0  terrain favorable SOUS-exploité  → « à conquérir »
                < 0  sur-performe son profil           → « bastion »
  R²        = qualité du modèle par bloc (publié pour la transparence : le socio
              explique bien le RN/écolo, peu la droite).

Pas de prétention prédictive : c'est un indice d'affinité socio-démographique,
pas un pronostic de résultat.

Sorties :
  public/electoral/potentiel_commune.parquet  (code + aff_/reel_/pot_ par bloc)
  public/electoral/potentiel_meta.json         (R², moyenne, poids par bloc)

Dépendances : duckdb, numpy.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGG = ROOT / "public" / "electoral" / "agg"
INSEE = ROOT / "public" / "insee"
OUT = ROOT / "public" / "electoral" / "potentiel_commune.parquet"
META = ROOT / "public" / "electoral" / "potentiel_meta.json"

REF = "presid-2022-t1"  # hypothèse à blocs séparés (lisible)
FEATS = ["partCadres", "partOuvriers", "part65plus", "tauxChomage",
         "partDiplomeSup", "partProprietaires", "partResSecondaires",
         "partFamMono", "partPersonnesSeules", "partNouveauxArrivants"]
LAMBDA = 5.0  # régularisation ridge (stabilise face à la multicolinéarité)

BLOCS = {
    "rn": ("RN", "UXD", "REC", "EXD", "DSV", "DLF"),
    "gauche": ("FI", "SOC", "COM", "EXG", "DXG", "DVG", "RDG"),
    "ecolo": ("ECO", "VEC"),
    "centre": ("ENS", "MDM", "HOR", "UDI", "DVC"),
    "droite": ("LR", "DVD"),
}


def main() -> int:
    try:
        import duckdb
        import numpy as np
    except ImportError:
        print("✗ pip3 install duckdb numpy requis", file=sys.stderr)
        return 1

    cand = (AGG / f"{REF}_candidats.parquet").as_posix()
    terr = (AGG / f"{REF}_territoires.parquet").as_posix()
    rp = (INSEE / "rp_2022_commune.parquet").as_posix()
    log = (INSEE / "logement_2022_commune.parquet").as_posix()
    fam = (INSEE / "famille_2022_commune.parquet").as_posix()
    mob = (INSEE / "mobilite_2022_commune.parquet").as_posix()
    for f in (cand, terr, rp, log, fam, mob):
        if not Path(f).exists():
            print(f"✗ source manquante : {f}", file=sys.stderr)
            return 1

    con = duckdb.connect()
    inl = lambda t: "(" + ",".join(f"'{c}'" for c in t) + ")"  # noqa: E731
    bloc_sel = ", ".join(
        f"sum(CASE WHEN nuance IN {inl(c)} THEN voix ELSE 0 END) AS {b}" for b, c in BLOCS.items()
    )
    pct_sel = ", ".join(f"100.0*b.{b}/NULLIF(t.exprimes,0) AS {b}_pct" for b in BLOCS)
    df = con.execute(
        f"""
        WITH b AS (SELECT code, {bloc_sel} FROM read_parquet('{cand}') WHERE maille='communes' GROUP BY code),
             t AS (SELECT code, exprimes FROM read_parquet('{terr}') WHERE maille='communes')
        SELECT t.code, t.exprimes, {pct_sel},
               r.partCadres, r.partOuvriers, r.part65plus, r.tauxChomage, r.partDiplomeSup,
               l.partProprietaires, l.partResSecondaires,
               fa.partFamMono, fa.partPersonnesSeules,
               mo.partNouveauxArrivants
        FROM t JOIN b USING(code)
        JOIN read_parquet('{rp}') r ON r.code = t.code
        JOIN read_parquet('{log}') l ON l.code = t.code
        JOIN read_parquet('{fam}') fa ON fa.code = t.code
        JOIN read_parquet('{mob}') mo ON mo.code = t.code
        """
    ).df()

    feat_ok = df[FEATS].notna().all(axis=1)
    base = df[feat_ok].copy()
    X = base[FEATS].to_numpy(float)
    mu, sd = X.mean(0), X.std(0)
    sd[sd == 0] = 1.0
    Xs = (X - mu) / sd
    A = np.column_stack([np.ones(len(Xs)), Xs])
    Rr = np.eye(A.shape[1]); Rr[0, 0] = 0.0  # pas de pénalité sur l'intercept

    meta = {"ref": REF, "feats": FEATS, "blocs": {}}
    out = base[["code"]].copy()
    for b in BLOCS:
        y = base[f"{b}_pct"].to_numpy(float)
        train = ~np.isnan(y)  # exclut les communes sans réel (exprimés nuls)
        coef = np.linalg.solve(A[train].T @ A[train] + LAMBDA * Rr, A[train].T @ y[train])
        pred = A @ coef
        yt, pt = y[train], pred[train]
        r2 = 1 - ((yt - pt) ** 2).sum() / max(((yt - yt.mean()) ** 2).sum(), 1e-9)
        aff = np.clip(pred, 0, 100)
        out[f"aff_{b}"] = aff.round(1)
        out[f"reel_{b}"] = y.round(1)
        out[f"pot_{b}"] = (aff - y).round(1)
        meta["blocs"][b] = {
            "r2": round(float(r2), 3),
            "moyenne": round(float(yt.mean()), 1),
            "poids": {f: round(float(c), 2) for f, c in zip(FEATS, coef[1:])},
        }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    con.register("out_df", out)
    con.execute(f"COPY out_df TO '{OUT.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
    META.write_text(json.dumps(meta, ensure_ascii=False, indent=1))

    print(f"  ✓ {OUT.relative_to(ROOT)}  ({OUT.stat().st_size/1024:.0f} Ko, {len(out):,} communes)")
    for b, m in meta["blocs"].items():
        print(f"    {b:7} R²={m['r2']:.2f}  moy={m['moyenne']:.1f}%")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
