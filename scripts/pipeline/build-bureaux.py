#!/usr/bin/env python3
"""
Agrégats électoraux au niveau BUREAU DE VOTE.

Produit, pour chaque scrutin disposant de résultats par bureau, deux Parquet
« longs » alignés sur le schéma des autres agrégats (`agg/{scrutin}_*.parquet`),
mais à la maille `bureaux` :

  agg/{scrutin}_bureaux_territoires.parquet
     maille='bureaux', code, libelle, inscrits, votants, exprimes,
     abstentions, blancs, nuls
  agg/{scrutin}_bureaux_candidats.parquet
     maille='bureaux', code, label, nuance, voix, elu

Le `code` est le `codeBureauVote` du standard officiel des contours de bureaux
de vote (Etalab / REU INSEE) : « {communeINSEE 5}_{numéroBV 4} », ex. 01001_0001.
Il permet la jointure directe avec le PMTiles
`repertoire-unique-electoral-polygons` (cf. scripts/pipeline/sources.json).

Sources lues :
  - présidentielle 2022 T1/T2  → Parquet committé public/electoral (nuance par nom)
  - législatives 2024 T1/T2    → Parquet committé public/electoral (nuance fournie)
  - présidentielle 2017 T1/T2  → txt brut data/raw/electoral (download.sh, nuance par nom)
  - législatives 2022 T1/T2    → txt brut data/raw/electoral (download.sh, nuance fournie)

Seuls les agrégats (~quelques Mo) sont committés ; les fichiers bruts (~35 Mo)
restent dans data/raw (gitignore).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ELECTORAL = ROOT / "public" / "electoral"
RAW = ROOT / "data" / "raw" / "electoral"
OUT = ELECTORAL / "agg"

# Nom de famille → nuance MinInt (présidentielles), aligné sur build-aggregates.
PRESID_NUANCE = {
    2017: {
        "ARTHAUD": "EXG", "POUTOU": "EXG", "DUPONT-AIGNAN": "DSV", "LE PEN": "RN",
        "MACRON": "ENS", "HAMON": "SOC", "ASSELINEAU": "DSV", "LASSALLE": "REG",
        "MÉLENCHON": "FI", "CHEMINADE": "DIV", "FILLON": "LR",
    },
    2022: {
        "ARTHAUD": "EXG", "POUTOU": "EXG", "ROUSSEL": "COM", "MÉLENCHON": "FI",
        "HIDALGO": "SOC", "JADOT": "ECO", "MACRON": "ENS", "LASSALLE": "REG",
        "PÉCRESSE": "LR", "DUPONT-AIGNAN": "DSV", "LE PEN": "RN", "ZEMMOUR": "REC",
    },
}
PRESID_2022_NUANCE = PRESID_NUANCE[2022]  # rétro-compat

# Schémas MinInt « wide » des fichiers bruts (présid. 2017, légis. 2022 bureau).
PRESID_BASE = [
    "Code du département", "Libellé du département", "Code de la circonscription",
    "Libellé de la circonscription", "Code de la commune", "Libellé de la commune",
    "Code du b.vote", "Inscrits", "Abstentions", "% Abs/Ins", "Votants", "% Vot/Ins",
    "Blancs", "% Blancs/Ins", "% Blancs/Vot", "Nuls", "% Nuls/Ins", "% Nuls/Vot",
    "Exprimés", "% Exp/Ins", "% Exp/Vot",
]
PRESID_CAND = ["N°Panneau", "Sexe", "Nom", "Prénom", "Voix", "% Voix/Ins", "% Voix/Exp"]
LEGIS22_BASE = list(PRESID_BASE)
LEGIS22_CAND = ["N°Panneau", "Sexe", "Nom", "Prénom", "Nuance", "Voix",
                "% Voix/Ins", "% Voix/Exp"]


def scan_maxcols(path: Path, enc: str, sep: str = ";") -> int:
    mx = 0
    with open(path, encoding=enc, errors="replace") as f:
        next(f)
        for line in f:
            n = line.count(sep) + 1
            if n > mx:
                mx = n
    return mx


def read_raw_names(path: Path, enc: str, base: list[str], cand: list[str], ncand: int) -> str:
    cols = list(base)
    for i in range(1, ncand + 1):
        for fld in cand:
            cols.append(f"{fld}__{i}")
    names = ", ".join(q(c) for c in cols)
    return f"""read_csv('{path.as_posix()}', sep=';', encoding='{enc}', header=true,
        names=[{names}], all_varchar=true, null_padding=true, ignore_errors=true)"""


def num(col: str) -> str:
    return f"TRY_CAST(replace(replace(CAST(\"{col}\" AS VARCHAR), ' ', ''), chr(160), '') AS BIGINT)"


def count_suffixed(con, path: Path, prefix: str) -> int:
    cols = con.execute(f"DESCRIBE SELECT * FROM read_parquet('{path.as_posix()}')").df()["column_name"].tolist()
    return sum(1 for c in cols if c.startswith(prefix))


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def presid_sql(con, path: Path, year: int):
    """(header_sql, cand_sql) pour un Parquet présidentielle (colonnes Nom_i…)."""
    commune = "lpad(CAST(\"Code du département\" AS VARCHAR),2,'0') || lpad(CAST(\"Code de la commune\" AS VARCHAR),3,'0')"
    bv = "lpad(CAST(\"Code du b.vote\" AS VARCHAR),4,'0')"
    code = f"{commune} || '_' || {bv}"
    src = f"read_parquet('{path.as_posix()}')"
    header = f"""
      SELECT 'bureaux' AS maille, {code} AS code,
             'Bureau ' || any_value({bv}) || ' · ' || any_value("Libellé de la commune") AS libelle,
             SUM({num('Inscrits')}) AS inscrits, SUM({num('Votants')}) AS votants,
             SUM({num('Exprimés')}) AS exprimes, SUM({num('Abstentions')}) AS abstentions,
             SUM({num('Blancs')}) AS blancs, SUM({num('Nuls')}) AS nuls
      FROM {src} WHERE "Code de la commune" IS NOT NULL GROUP BY code
    """
    ncand = count_suffixed(con, path, "Nom_")
    whens = " ".join(
        f"WHEN upper(trim(nom)) = {q(n)} THEN {q(nu)}"
        for n, nu in PRESID_2022_NUANCE.items()
    )
    unions = []
    for i in range(1, ncand + 1):
        unions.append(f"""
          SELECT {code} AS code, "Nom_{i}" AS nom, {num(f'Voix_{i}')} AS voix
          FROM {src} WHERE "Nom_{i}" IS NOT NULL
        """)
    cand = f"""
      WITH raw AS ({' UNION ALL '.join(unions)})
      SELECT 'bureaux' AS maille, code, nom AS label,
             CASE {whens} ELSE NULL END AS nuance, voix, false AS elu
      FROM raw WHERE voix IS NOT NULL
    """
    return header, cand


def legis_sql(con, path: Path):
    """(header_sql, cand_sql) pour un Parquet législatives par bureau."""
    commune = "lpad(CAST(\"Code commune\" AS VARCHAR),5,'0')"
    bv = "lpad(CAST(\"Code BV\" AS VARCHAR),4,'0')"
    code = f"{commune} || '_' || {bv}"
    src = f"read_parquet('{path.as_posix()}')"
    header = f"""
      SELECT 'bureaux' AS maille, {code} AS code,
             'Bureau ' || any_value({bv}) || ' · ' || any_value("Libellé commune") AS libelle,
             SUM({num('Inscrits')}) AS inscrits, SUM({num('Votants')}) AS votants,
             SUM({num('Exprimés')}) AS exprimes, SUM({num('Abstentions')}) AS abstentions,
             SUM({num('Blancs')}) AS blancs, SUM({num('Nuls')}) AS nuls
      FROM {src} WHERE "Code commune" IS NOT NULL GROUP BY code
    """
    ncand = count_suffixed(con, path, "Nuance candidat ")
    unions = []
    for i in range(1, ncand + 1):
        unions.append(f"""
          SELECT {code} AS code, "Nom candidat {i}" AS label,
                 "Nuance candidat {i}" AS nuance, {num(f'Voix {i}')} AS voix,
                 (nullif(trim(CAST("Elu {i}" AS VARCHAR)), '') IS NOT NULL) AS elu
          FROM {src} WHERE "Nuance candidat {i}" IS NOT NULL
        """)
    cand = f"""
      SELECT 'bureaux' AS maille, code, label, nuance, SUM(voix) AS voix, bool_or(elu) AS elu
      FROM ({' UNION ALL '.join(unions)})
      WHERE voix IS NOT NULL
      GROUP BY code, label, nuance
    """
    return header, cand


def presid_raw_sql(con, path: Path, year: int):
    """(header, cand) depuis un fichier brut présidentielle (txt latin-1)."""
    ncand = (scan_maxcols(path, "latin-1") - len(PRESID_BASE)) // len(PRESID_CAND)
    src = read_raw_names(path, "latin-1", PRESID_BASE, PRESID_CAND, ncand)
    commune = "lpad(\"Code du département\",2,'0') || lpad(\"Code de la commune\",3,'0')"
    bv = "lpad(\"Code du b.vote\",4,'0')"
    code = f"{commune} || '_' || {bv}"
    header = f"""
      SELECT 'bureaux' AS maille, {code} AS code,
             'Bureau ' || any_value({bv}) || ' · ' || any_value("Libellé de la commune") AS libelle,
             SUM({num('Inscrits')}) AS inscrits, SUM({num('Votants')}) AS votants,
             SUM({num('Exprimés')}) AS exprimes, SUM({num('Abstentions')}) AS abstentions,
             SUM({num('Blancs')}) AS blancs, SUM({num('Nuls')}) AS nuls
      FROM {src} WHERE "Code de la commune" IS NOT NULL GROUP BY code
    """
    whens = " ".join(
        f"WHEN upper(trim(nom)) = {q(n)} THEN {q(nu)}"
        for n, nu in PRESID_NUANCE[year].items()
    )
    unions = " UNION ALL ".join(
        f'SELECT {code} AS code, "Nom__{i}" AS nom, {num(f"Voix__{i}")} AS voix '
        f'FROM {src} WHERE "Nom__{i}" IS NOT NULL'
        for i in range(1, ncand + 1)
    )
    cand = f"""
      WITH raw AS ({unions})
      SELECT 'bureaux' AS maille, code, nom AS label,
             CASE {whens} ELSE NULL END AS nuance, voix, false AS elu
      FROM raw WHERE voix IS NOT NULL
    """
    return header, cand


def legis22_raw_sql(con, path: Path):
    """(header, cand) depuis un fichier brut législatives 2022 par bureau (txt)."""
    ncand = (scan_maxcols(path, "latin-1") - len(LEGIS22_BASE)) // len(LEGIS22_CAND)
    src = read_raw_names(path, "latin-1", LEGIS22_BASE, LEGIS22_CAND, ncand)
    commune = "lpad(\"Code du département\",2,'0') || lpad(\"Code de la commune\",3,'0')"
    bv = "lpad(\"Code du b.vote\",4,'0')"
    code = f"{commune} || '_' || {bv}"
    header = f"""
      SELECT 'bureaux' AS maille, {code} AS code,
             'Bureau ' || any_value({bv}) || ' · ' || any_value("Libellé de la commune") AS libelle,
             SUM({num('Inscrits')}) AS inscrits, SUM({num('Votants')}) AS votants,
             SUM({num('Exprimés')}) AS exprimes, SUM({num('Abstentions')}) AS abstentions,
             SUM({num('Blancs')}) AS blancs, SUM({num('Nuls')}) AS nuls
      FROM {src} WHERE "Code de la commune" IS NOT NULL GROUP BY code
    """
    unions = " UNION ALL ".join(
        f'SELECT {code} AS code, "Nom__{i}" AS label, "Nuance__{i}" AS nuance, '
        f'{num(f"Voix__{i}")} AS voix FROM {src} WHERE "Nuance__{i}" IS NOT NULL'
        for i in range(1, ncand + 1)
    )
    cand = f"""
      SELECT 'bureaux' AS maille, code, label, nuance, SUM(voix) AS voix, false AS elu
      FROM ({unions}) WHERE voix IS NOT NULL GROUP BY code, label, nuance
    """
    return header, cand


# (scrutin, source_file, kind, year) — kind ∈ presid|legis (parquet committé) / presid_raw|legis_raw (txt brut)
SCRUTINS = [
    ("presid-2017-t1", RAW / "presidentielle_2017_t1.txt", "presid_raw", 2017),
    ("presid-2017-t2", RAW / "presidentielle_2017_t2.txt", "presid_raw", 2017),
    ("presid-2022-t1", ELECTORAL / "presidentielle_2022_t1.parquet", "presid", 2022),
    ("presid-2022-t2", ELECTORAL / "presidentielle_2022_t2.parquet", "presid", 2022),
    ("legis-2022-t1", RAW / "legislatives_2022_t1_bureau.txt", "legis_raw", None),
    ("legis-2022-t2", RAW / "legislatives_2022_t2_bureau.txt", "legis_raw", None),
    ("legis-2024-t1", ELECTORAL / "legislatives_2024_t1_bureau.parquet", "legis", None),
    ("legis-2024-t2", ELECTORAL / "legislatives_2024_t2_bureau.parquet", "legis", None),
]


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1
    con = duckdb.connect()
    con.execute("PRAGMA threads=4;")
    OUT.mkdir(parents=True, exist_ok=True)

    for scrutin, src, kind, year in SCRUTINS:
        if not src.exists():
            print(f"  ⚠ {scrutin}: source manquante {src.name} (run download.sh)")
            continue
        if kind == "presid":
            header, cand = presid_sql(con, src, year)
        elif kind == "legis":
            header, cand = legis_sql(con, src)
        elif kind == "presid_raw":
            header, cand = presid_raw_sql(con, src, year)
        else:  # legis_raw
            header, cand = legis22_raw_sql(con, src)
        terr_out = OUT / f"{scrutin}_bureaux_territoires.parquet"
        cand_out = OUT / f"{scrutin}_bureaux_candidats.parquet"
        con.execute(f"COPY ({header}) TO '{terr_out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        con.execute(f"COPY ({cand}) TO '{cand_out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)")
        nt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{terr_out.as_posix()}')").fetchone()[0]
        nc = con.execute(f"SELECT COUNT(*) FROM read_parquet('{cand_out.as_posix()}')").fetchone()[0]
        kb = (terr_out.stat().st_size + cand_out.stat().st_size) / 1024
        print(f"  ✓ {scrutin}: {nt} bureaux, {nc} lignes candidats ({kb:.0f} Ko)")

    print("\n✓ Agrégats bureaux produits dans public/electoral/agg/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
