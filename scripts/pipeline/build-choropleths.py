#!/usr/bin/env python3
"""
Choroplèthes figées (précalcul des agrégats électoraux).

Sort les coloriages de carte du chemin DuckDB-WASM : pour chaque scrutin
électoral × maille « fine » servie par la carte (regions, departements,
circonscriptions, communes — PAS les bureaux, trop volumineux et chargés au
zoom), on fige en JSON statique les trois métriques que `explorer-view`
calculait à la volée côté navigateur :

  public/electoral/choro/{scrutin}_{maille}.json
    {
      "vainqueur":      { "<code>": "<nuance>", … },   # nuance gagnante
      "participation":  { "<code>": 0.4213, … },        # votants / inscrits
      "abstention":     { "<code>": 0.5787, … }         # abstentions / inscrits
    }

  public/electoral/choro/manifest.json
    { "keys": ["presid-2022-t1_communes", …] }          # ce qui est figé

Le SQL réplique EXACTEMENT celui des hooks `useScrutinWinner` /
`useScrutinMetric` (src/lib/queries.ts) : la sortie figée et le repli DuckDB
doivent être indiscernables. Source : les Parquet `*_candidats` / `*_territoires`
produits par build-aggregates.py. À lancer après lui dans all.sh.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / "public"
AGG = PUBLIC / "electoral" / "agg"
INSEE = PUBLIC / "insee"
ELECT = PUBLIC / "electoral"
OUT = PUBLIC / "electoral" / "choro"

# Scrutins électoraux × mailles à figer (miroir de SCRUTIN_META côté app, hors
# « bureaux »). Présidentielles + législatives : 4 mailles ; municipales : pas
# de circonscriptions.
WITH_CIRCO = ["regions", "departements", "circonscriptions", "communes"]
NO_CIRCO = ["regions", "departements", "communes"]
SCRUTINS: dict[str, list[str]] = {
    "presid-2017-t1": WITH_CIRCO, "presid-2017-t2": WITH_CIRCO,
    "presid-2022-t1": WITH_CIRCO, "presid-2022-t2": WITH_CIRCO,
    "legis-2022-t1": WITH_CIRCO, "legis-2022-t2": WITH_CIRCO,
    "legis-2024-t1": WITH_CIRCO, "legis-2024-t2": WITH_CIRCO,
    "municipales-2026-t1": NO_CIRCO, "municipales-2026-t2": NO_CIRCO,
}

ROUND = 4  # décimales conservées pour les ratios (≈ 0,01 point de %)


def winner(con, cand: Path, maille: str) -> dict[str, str]:
    """Nuance gagnante par territoire — miroir de useScrutinWinner."""
    rows = con.execute(
        f"""
        WITH s AS (
          SELECT code, nuance, SUM(voix) AS v
          FROM read_parquet('{cand.as_posix()}')
          WHERE maille = ? AND nuance IS NOT NULL
          GROUP BY code, nuance
        )
        SELECT code, nuance FROM s
        QUALIFY ROW_NUMBER() OVER (PARTITION BY code ORDER BY v DESC, nuance) = 1
        """,
        [maille],
    ).fetchall()
    return {str(c): n for c, n in rows if c and n}


def metric(con, terr: Path, maille: str, numer: str) -> dict[str, float]:
    """Ratio sur inscrits par territoire — miroir de useScrutinMetric."""
    rows = con.execute(
        f"""
        SELECT code, CAST({numer} AS DOUBLE) / inscrits AS value
        FROM read_parquet('{terr.as_posix()}')
        WHERE maille = ? AND inscrits > 0
        """,
        [maille],
    ).fetchall()
    out: dict[str, float] = {}
    for c, v in rows:
        if c is None or v is None:
            continue
        out[str(c)] = round(float(v), ROUND)
    return out


# ─── Choroplèthes thématiques (socio / tendances / potentiel) ────────────────
# Colonnes figées par dataset, miroir des listes blanches de src/lib/queries.ts.
# Toutes au niveau commune sauf les tendances (maille portée par le parquet).

FILOSOFI_COLUMNS = [
    "MED_SL", "PR_MD60", "D1_SL", "D9_SL", "IR_D9_D1_SL",
    "S_RET_PEN_DI", "S_SOC_BEN_DI", "S_EI_DI_UNE", "S_HH_TAX",
]
RP_COLUMNS = [
    "part65plus", "partMoins15", "tauxChomage",
    "partCadres", "partOuvriers", "partDiplomeSup",
]
LOGEMENT_COLUMNS = ["partProprietaires", "partLocataires", "partResSecondaires", "partLogVacants"]
FAMILLE_COLUMNS = ["partFamMono", "partPersonnesSeules"]
MOBILITE_COLUMNS = ["partNouveauxArrivants"]
POTENTIEL_COLUMNS = ["pot_rn", "pot_gauche", "pot_ecolo", "pot_centre", "pot_droite"]
TREND_COLUMNS = ["d_abstention", "d_rn", "d_gauche"]
TREND_FILES = ["presid_2017_2022", "legis_2022_2024"]
TREND_MAILLES = ["regions", "departements", "circonscriptions", "communes"]


def emit_columns(con, name, src, columns, maille=None) -> str | None:
    """Émet OUT/{name}.json = {colonne: {code: round(valeur, ROUND)}}.

    `maille` filtre les parquets multi-mailles (tendances) ; None pour les
    parquets commune (code = INSEE)."""
    if not src.exists():
        print(f"  ⚠ {name}: source manquante {src.name}")
        return None
    where = f"maille = '{maille}' AND " if maille else ""
    payload: dict[str, dict[str, float]] = {}
    for col in columns:
        rows = con.execute(
            f"SELECT code, {col} AS v FROM read_parquet('{src.as_posix()}') "
            f"WHERE {where}{col} IS NOT NULL"
        ).fetchall()
        payload[col] = {
            str(c): round(float(v), ROUND) for c, v in rows if c is not None and v is not None
        }
    (OUT / f"{name}.json").write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
    )
    total = sum(len(d) for d in payload.values())
    print(f"  ✓ {name}: {len(columns)} colonnes, {total} valeurs")
    return name


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    con = duckdb.connect()
    con.execute("PRAGMA threads=4;")
    OUT.mkdir(parents=True, exist_ok=True)

    keys: list[str] = []
    for scrutin, mailles in SCRUTINS.items():
        cand = AGG / f"{scrutin}_candidats.parquet"
        terr = AGG / f"{scrutin}_territoires.parquet"
        if not cand.exists() or not terr.exists():
            print(f"  ⚠ {scrutin}: agrégats manquants, ignoré")
            continue
        for m in mailles:
            payload = {
                "vainqueur": winner(con, cand, m),
                "participation": metric(con, terr, m, "votants"),
                "abstention": metric(con, terr, m, "abstentions"),
            }
            if not payload["vainqueur"] and not payload["participation"]:
                # Maille absente de ce scrutin (ex. circo en municipale) → on saute.
                continue
            key = f"{scrutin}_{m}"
            (OUT / f"{key}.json").write_text(
                json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                encoding="utf-8",
            )
            keys.append(key)
            print(
                f"  ✓ {key}: {len(payload['vainqueur'])} vainqueurs, "
                f"{len(payload['participation'])} territoires"
            )

    # ── Choroplèthes thématiques (socio / tendances / potentiel) ──────────────
    print("→ thématiques (socio / tendances / potentiel)")
    thematic = [
        emit_columns(con, "socio_filosofi_communes", INSEE / "filosofi_2021_commune.parquet", FILOSOFI_COLUMNS),
        emit_columns(con, "socio_rp_communes", INSEE / "rp_2022_commune.parquet", RP_COLUMNS),
        emit_columns(con, "socio_logement_communes", INSEE / "logement_2022_commune.parquet", LOGEMENT_COLUMNS),
        emit_columns(con, "socio_famille_communes", INSEE / "famille_2022_commune.parquet", FAMILLE_COLUMNS),
        emit_columns(con, "socio_mobilite_communes", INSEE / "mobilite_2022_commune.parquet", MOBILITE_COLUMNS),
        emit_columns(con, "potentiel_communes", ELECT / "potentiel_commune.parquet", POTENTIEL_COLUMNS),
    ]
    for tfile in TREND_FILES:
        src = ELECT / "trends" / f"{tfile}.parquet"
        for m in TREND_MAILLES:
            thematic.append(emit_columns(con, f"trends_{tfile}_{m}", src, TREND_COLUMNS, maille=m))
    keys.extend(k for k in thematic if k)

    (OUT / "manifest.json").write_text(
        json.dumps({"keys": keys}, separators=(",", ":")), encoding="utf-8"
    )
    print(f"\n✓ {len(keys)} choroplèthes figées dans public/electoral/choro/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
