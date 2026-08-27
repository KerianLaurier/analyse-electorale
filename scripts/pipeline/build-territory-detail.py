#!/usr/bin/env python3
"""
Détail par territoire figé (précalcul des fiches au clic), sans DuckDB-WASM.

Pour chaque scrutin électoral × maille, fige le détail d'un territoire (chiffres
clés + liste des candidats triés) tel que le calculait `fetchScrutinDetail`
(src/lib/queries.ts) côté navigateur :

  public/electoral/detail/{scrutin}_{maille}.json              (régions, dépt, circo)
  public/electoral/detail/{scrutin}_{maille}/{dept}.json       (communes, bureaux — shardé)

    { "<code>": { "l": libellé, "i": inscrits, "v": votants, "e": exprimés,
                  "a": abstentions, "b": blancs, "n": nuls,
                  "c": [[label, nuance, voix, élu(0/1)], …] } }   # triés voix desc

Clés courtes pour limiter le poids (communes ≈ 35 k, bureaux ≈ 70 k). Le client
recompose ScrutinDetail (pct = voix/exprimés, regroupement par nuance pour les
législatives au niveau commune) — on stocke donc les candidats bruts.

Émet aussi deux petits index :
  public/electoral/detail/national_participation.json  { scrutin: participation }
  public/electoral/detail/circo_list.json              [ {code, libelle}, … ]

Source : les agrégats public/electoral/agg/*. À lancer après build-aggregates.py.
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AGG = ROOT / "public" / "electoral" / "agg"
INSEE = ROOT / "public" / "insee"
OUT = ROOT / "public" / "electoral" / "detail"

# Colonnes socio portées par bureau (miroir de useSociologieBureau).
BUREAUX_SOCIO_COLUMNS = [
    "MED_SL", "PR_MD60", "IR_D9_D1_SL", "S_RET_PEN_DI", "S_SOC_BEN_DI",
    "part65plus", "tauxChomage", "partCadres", "partOuvriers", "partDiplomeSup",
]

# Scrutins électoraux × mailles (miroir de SCRUTIN_META). Bureaux inclus pour les
# scrutins qui en disposent — c'est-à-dire tous, depuis l'ajout des municipales.
WITH_BUREAUX = ["regions", "departements", "circonscriptions", "communes", "bureaux"]
# Européennes et municipales : pas de circonscription législative, bureaux oui.
NO_CIRCO_BUREAUX = ["regions", "departements", "communes", "bureaux"]
SCRUTINS: dict[str, list[str]] = {
    "presid-2017-t1": WITH_BUREAUX, "presid-2017-t2": WITH_BUREAUX,
    "presid-2022-t1": WITH_BUREAUX, "presid-2022-t2": WITH_BUREAUX,
    "legis-2017-t1": WITH_BUREAUX, "legis-2017-t2": WITH_BUREAUX,
    "legis-2022-t1": WITH_BUREAUX, "legis-2022-t2": WITH_BUREAUX,
    "legis-2024-t1": WITH_BUREAUX, "legis-2024-t2": WITH_BUREAUX,
    "euro-2019-t1": NO_CIRCO_BUREAUX, "euro-2024-t1": NO_CIRCO_BUREAUX,
    "municipales-2020-t1": NO_CIRCO_BUREAUX, "municipales-2020-t2": NO_CIRCO_BUREAUX,
    "municipales-2026-t1": NO_CIRCO_BUREAUX, "municipales-2026-t2": NO_CIRCO_BUREAUX,
}
SHARDED = {"communes", "bureaux"}  # trop volumineux → un fichier par département


def agg_path(scrutin: str, kind: str, maille: str) -> Path:
    suffix = "_bureaux" if maille == "bureaux" else ""
    return AGG / f"{scrutin}{suffix}_{kind}.parquet"


def dept_of(maille: str, code: str) -> str:
    """Département de rattachement pour le shardage (communes/bureaux)."""
    if maille == "bureaux":
        code = code.split("_", 1)[0]
    return code[:2]


def write_json(path: Path, payload) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return len(payload)


def build_detail(con, scrutin: str, maille: str) -> int:
    terr_p = agg_path(scrutin, "territoires", maille)
    cand_p = agg_path(scrutin, "candidats", maille)
    if not terr_p.exists() or not cand_p.exists():
        return 0

    terr = con.execute(
        f"""SELECT code, libelle, inscrits, votants, exprimes, abstentions, blancs, nuls
            FROM read_parquet('{terr_p.as_posix()}') WHERE maille = ? AND code IS NOT NULL""",
        [maille],
    ).fetchall()
    if not terr:
        return 0

    cands = con.execute(
        f"""SELECT code, label, nuance, voix, elu
            FROM read_parquet('{cand_p.as_posix()}')
            WHERE maille = ? AND code IS NOT NULL AND voix IS NOT NULL
            ORDER BY code, voix DESC""",
        [maille],
    ).fetchall()

    by_code: dict[str, list] = defaultdict(list)
    for code, label, nuance, voix, elu in cands:
        by_code[str(code)].append([label, nuance, int(voix or 0), 1 if elu else 0])

    entries: dict[str, dict] = {}
    for code, lib, ins, vot, exp, abst, blc, nul in terr:
        c = str(code)
        entries[c] = {
            "l": lib, "i": int(ins or 0), "v": int(vot or 0), "e": int(exp or 0),
            "a": int(abst or 0), "b": int(blc or 0), "n": int(nul or 0),
            "c": by_code.get(c, []),
        }

    if maille in SHARDED:
        shards: dict[str, dict] = defaultdict(dict)
        for code, entry in entries.items():
            shards[dept_of(maille, code)][code] = entry
        for dept, payload in shards.items():
            write_json(OUT / f"{scrutin}_{maille}" / f"{dept}.json", payload)
        print(f"  ✓ {scrutin}_{maille}: {len(entries)} territoires, {len(shards)} shards")
    else:
        write_json(OUT / f"{scrutin}_{maille}.json", entries)
        print(f"  ✓ {scrutin}_{maille}: {len(entries)} territoires")
    return len(entries)


def build_scalars(con) -> None:
    # Participation nationale (métropole) par scrutin : SUM(votants)/SUM(inscrits)
    # au niveau départements (miroir de useScrutinNationalParticipation).
    national: dict[str, float] = {}
    for scrutin in SCRUTINS:
        terr_p = agg_path(scrutin, "territoires", "departements")
        if not terr_p.exists():
            continue
        row = con.execute(
            f"""SELECT CAST(SUM(votants) AS DOUBLE) / NULLIF(SUM(inscrits), 0) AS v
                FROM read_parquet('{terr_p.as_posix()}') WHERE maille = 'departements' AND inscrits > 0"""
        ).fetchone()
        if row and row[0] is not None:
            national[scrutin] = round(float(row[0]), 6)
    write_json(OUT / "national_participation.json", national)
    print(f"  ✓ national_participation: {len(national)} scrutins")

    # Liste des circonscriptions (miroir de useCircoList) depuis Légis. 2024 T1.
    terr_p = agg_path("legis-2024-t1", "territoires", "circonscriptions")
    if terr_p.exists():
        rows = con.execute(
            f"""SELECT code, any_value(libelle) AS libelle
                FROM read_parquet('{terr_p.as_posix()}')
                WHERE maille = 'circonscriptions' GROUP BY code ORDER BY code"""
        ).fetchall()
        circos = [{"code": str(c), "libelle": lib or str(c)} for c, lib in rows]
        OUT.mkdir(parents=True, exist_ok=True)
        (OUT / "circo_list.json").write_text(
            json.dumps(circos, ensure_ascii=False, separators=(",", ":")), encoding="utf-8"
        )
        print(f"  ✓ circo_list: {len(circos)} circonscriptions")


def build_bureaux_socio(con) -> None:
    """Profil socio par bureau (porté par la commune), shardé par département —
    miroir de useSociologieBureau. socio_grain reste exposé pour transparence."""
    src = INSEE / "bureaux_socio.parquet"
    if not src.exists():
        print("  ⚠ bureaux_socio: source manquante, ignoré")
        return
    cols = ", ".join(BUREAUX_SOCIO_COLUMNS)
    rows = con.execute(
        f"SELECT code, insee, socio_grain, {cols} FROM read_parquet('{src.as_posix()}')"
    ).fetchall()
    shards: dict[str, dict] = defaultdict(dict)
    for r in rows:
        code, insee, grain = str(r[0]), str(r[1]), r[2]
        entry = {"ins": insee, "g": grain}
        for i, col in enumerate(BUREAUX_SOCIO_COLUMNS):
            v = r[3 + i]
            entry[col] = round(float(v), 4) if v is not None else None
        shards[code[:2]][code] = entry
    for dept, payload in shards.items():
        write_json(OUT / "socio_bureaux" / f"{dept}.json", payload)
    print(f"  ✓ socio_bureaux: {len(rows)} bureaux, {len(shards)} shards")


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1

    con = duckdb.connect()
    con.execute("PRAGMA threads=4;")
    OUT.mkdir(parents=True, exist_ok=True)

    total = 0
    for scrutin, mailles in SCRUTINS.items():
        for maille in mailles:
            total += build_detail(con, scrutin, maille)
    build_scalars(con)
    build_bureaux_socio(con)

    print(f"\n✓ détail par territoire figé dans public/electoral/detail/ ({total} lignes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
