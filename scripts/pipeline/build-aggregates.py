#!/usr/bin/env python3
"""
Agrégateur électoral unifié multi-maille.

Lit les fichiers bruts MinInt (présidentielles, législatives, municipales) et
produit, pour chaque scrutin × tour, deux Parquet « longs » prêts à requêter
côté DuckDB-WASM :

  public/electoral/agg/{scrutin}_territoires.parquet
     maille, code, libelle, inscrits, votants, exprimes, abstentions, blancs, nuls

  public/electoral/agg/{scrutin}_candidats.parquet
     maille, code, label, nuance, voix, elu

Mailles produites :
  - présidentielles : regions, departements, circonscriptions, communes
  - législatives    : regions, departements, circonscriptions (par circo),
                      communes (agrégé depuis les bureaux)
  - municipales     : regions, departements, communes (pas de circo)

Codes alignés sur les GeoJSON :
  region = code INSEE région (11, 24, …) ; departement = "01".."95","2A","2B" ;
  circonscription = dept(2) + circo(2) (ex. "0104") ; commune = INSEE 5 car.

Pour les présidentielles, la nuance n'est pas dans le fichier : on l'injecte
depuis un mapping (nom de famille → nuance). Pour législatives/municipales,
la nuance vient du fichier ; aux mailles agrégées (dept/région) les candidats
sont regroupés par nuance.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "electoral"
OUT = ROOT / "public" / "electoral" / "agg"

# ─── Mapping département → région (métropole + Corse) ─────────────────────────
DEPT_TO_REGION = {
    **{d: "84" for d in ["01","03","07","15","26","38","42","43","63","69","73","74"]},
    **{d: "27" for d in ["21","25","39","58","70","71","89","90"]},
    **{d: "53" for d in ["22","29","35","56"]},
    **{d: "24" for d in ["18","28","36","37","41","45"]},
    **{d: "94" for d in ["2A","2B"]},
    **{d: "44" for d in ["08","10","51","52","54","55","57","67","68","88"]},
    **{d: "32" for d in ["02","59","60","62","80"]},
    **{d: "11" for d in ["75","77","78","91","92","93","94","95"]},
    **{d: "28" for d in ["14","27","50","61","76"]},
    **{d: "75" for d in ["16","17","19","23","24","33","40","47","64","79","86","87"]},
    **{d: "76" for d in ["09","11","12","30","31","32","34","46","48","65","66","81","82"]},
    **{d: "52" for d in ["44","49","53","72","85"]},
    **{d: "93" for d in ["04","05","06","13","83","84"]},
}
REGION_NAMES = {
    "84": "Auvergne-Rhône-Alpes", "27": "Bourgogne-Franche-Comté",
    "53": "Bretagne", "24": "Centre-Val de Loire", "94": "Corse",
    "44": "Grand Est", "32": "Hauts-de-France", "11": "Île-de-France",
    "28": "Normandie", "75": "Nouvelle-Aquitaine", "76": "Occitanie",
    "52": "Pays de la Loire", "93": "Provence-Alpes-Côte d'Azur",
}

# ─── Mapping candidats présidentielles → nuance ──────────────────────────────
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

# ─── Champs des fichiers MinInt (format « wide ») ────────────────────────────
PRESID_BASE = [
    "Code du département","Libellé du département","Code de la circonscription",
    "Libellé de la circonscription","Code de la commune","Libellé de la commune",
    "Code du b.vote","Inscrits","Abstentions","% Abs/Ins","Votants","% Vot/Ins",
    "Blancs","% Blancs/Ins","% Blancs/Vot","Nuls","% Nuls/Ins","% Nuls/Vot",
    "Exprimés","% Exp/Ins","% Exp/Vot",
]
PRESID_CAND = ["N°Panneau","Sexe","Nom","Prénom","Voix","% Voix/Ins","% Voix/Exp"]

LEGIS22_CIRCO_BASE = [
    "Code du département","Libellé du département","Code de la circonscription",
    "Libellé de la circonscription","Etat saisie","Inscrits","Abstentions",
    "% Abs/Ins","Votants","% Vot/Ins","Blancs","% Blancs/Ins","% Blancs/Vot",
    "Nuls","% Nuls/Ins","% Nuls/Vot","Exprimés","% Exp/Ins","% Exp/Vot",
]
LEGIS22_CIRCO_CAND = ["N°Panneau","Sexe","Nom","Prénom","Nuance","Voix",
                      "% Voix/Ins","% Voix/Exp","Sièges"]

LEGIS22_BUREAU_BASE = [
    "Code du département","Libellé du département","Code de la circonscription",
    "Libellé de la circonscription","Code de la commune","Libellé de la commune",
    "Code du b.vote","Inscrits","Abstentions","% Abs/Ins","Votants","% Vot/Ins",
    "Blancs","% Blancs/Ins","% Blancs/Vot","Nuls","% Nuls/Ins","% Nuls/Vot",
    "Exprimés","% Exp/Ins","% Exp/Vot",
]
LEGIS22_BUREAU_CAND = ["N°Panneau","Sexe","Nom","Prénom","Nuance","Voix",
                       "% Voix/Ins","% Voix/Exp"]


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def scan_maxcols(path: Path, enc: str, sep: str = ";") -> int:
    """Nombre maximum de champs sur une ligne (détecte le nb de candidats)."""
    mx = 0
    with open(path, encoding=enc, errors="replace") as f:
        next(f)
        for line in f:
            c = line.count(sep) + 1
            if c > mx:
                mx = c
    return mx


def count_named(path: Path, enc: str, prefix: str, sep: str = ";") -> int:
    """Compte les colonnes d'en-tête commençant par `prefix` (fichiers nommés)."""
    import csv

    with open(path, encoding=enc, errors="replace") as f:
        header = next(csv.reader(f, delimiter=sep))
    return sum(1 for c in header if c.strip().startswith(prefix))


def names_clause(base: list[str], cand: list[str], n: int) -> str:
    cols = list(base)
    for i in range(1, n + 1):
        for f in cand:
            cols.append(f"{f}__{i}")
    return "names=[" + ", ".join(q(c) for c in cols) + "],"


def num(col: str) -> str:
    """Nettoie un entier MinInt ('1 234' → 1234)."""
    return f"TRY_CAST(replace(replace(\"{col}\", ' ', ''), chr(160), '') AS BIGINT)"


def read_raw(con, src: Path, enc: str, names: str | None):
    nclause = names if names else ""
    return f"""
      read_csv('{src.as_posix()}', sep=';', encoding='{enc}',
               header=true, {nclause}
               all_varchar=true, null_padding=true, ignore_errors=true)
    """


def region_case(dept_expr: str) -> str:
    whens = " ".join(
        f"WHEN {dept_expr} = {q(d)} THEN {q(r)}" for d, r in DEPT_TO_REGION.items()
    )
    return f"CASE {whens} ELSE NULL END"


def region_name_case(code_expr: str) -> str:
    whens = " ".join(
        f"WHEN {code_expr} = {q(c)} THEN {q(n)}" for c, n in REGION_NAMES.items()
    )
    return f"CASE {whens} ELSE NULL END"


def presid_nuance_case(year: int, nom_expr: str) -> str:
    whens = " ".join(
        f"WHEN upper(trim({nom_expr})) = {q(nom)} THEN {q(nu)}"
        for nom, nu in PRESID_NUANCE[year].items()
    )
    return f"CASE {whens} ELSE NULL END"


# ─── Construction des relations « longues » ──────────────────────────────────

def presid_long(con, src, enc, ncand, year):
    """Renvoie (sql_header, sql_cand) au niveau bureau pour une présidentielle."""
    names = names_clause(PRESID_BASE, PRESID_CAND, ncand)
    raw = read_raw(con, src, enc, names)
    dept = "lpad(\"Code du département\", 2, '0')"
    commune = f"{dept} || lpad(\"Code de la commune\", 3, '0')"
    circo = f"{dept} || lpad(\"Code de la circonscription\", 2, '0')"
    region = region_case(dept)

    header = f"""
      SELECT
        {region} AS c_region, {dept} AS c_dept, {circo} AS c_circo, {commune} AS c_commune,
        "Libellé du département" AS lib_dept,
        "Libellé de la circonscription" AS lib_circo,
        "Libellé de la commune" AS lib_commune,
        {num('Inscrits')} AS ins, {num('Votants')} AS vot, {num('Exprimés')} AS exp,
        {num('Abstentions')} AS abst, {num('Blancs')} AS blc, {num('Nuls')} AS nul
      FROM {raw}
      WHERE "Code de la commune" IS NOT NULL
    """

    unions = []
    for i in range(1, ncand + 1):
        nom = f'"Nom__{i}"'
        unions.append(f"""
          SELECT
            {region} AS c_region, {dept} AS c_dept, {circo} AS c_circo, {commune} AS c_commune,
            {nom} AS label, {presid_nuance_case(year, nom)} AS nuance,
            {num(f'Voix__{i}')} AS voix, false AS elu
          FROM {raw}
          WHERE {nom} IS NOT NULL
        """)
    cand = " UNION ALL ".join(unions)
    return header, cand, ["regions", "departements", "circonscriptions", "communes"], "nom"


def legis_circo_long(con, src, enc, is_csv, ncand, base, candf):
    """Header + candidats au niveau circonscription (législatives)."""
    if is_csv:
        raw = read_raw(con, src, enc, None)
        dept = "lpad(\"Code département\", 2, '0')"
        circo = f"{dept} || right(\"Code circonscription législative\", 2)"
        region = region_case(dept)
        lib_circo = '"Libellé circonscription législative"'
        lib_dept = '"Libellé département"'
        header = f"""
          SELECT {region} AS c_region, {dept} AS c_dept, {circo} AS c_circo,
                 {lib_dept} AS lib_dept, {lib_circo} AS lib_circo,
                 {num('Inscrits')} AS ins, {num('Votants')} AS vot, {num('Exprimés')} AS exp,
                 {num('Abstentions')} AS abst, {num('Blancs')} AS blc, {num('Nuls')} AS nul
          FROM {raw}
          WHERE "Code circonscription législative" IS NOT NULL
        """
        unions = []
        for i in range(1, ncand + 1):
            nu = f'"Nuance candidat {i}"'
            unions.append(f"""
              SELECT {region} AS c_region, {dept} AS c_dept, {circo} AS c_circo,
                     "Nom candidat {i}" AS label, {nu} AS nuance,
                     {num(f'Voix {i}')} AS voix,
                     (nullif(trim("Elu {i}"), '') IS NOT NULL) AS elu
              FROM {raw} WHERE {nu} IS NOT NULL
            """)
        cand = " UNION ALL ".join(unions)
    else:
        names = names_clause(base, candf, ncand)
        raw = read_raw(con, src, enc, names)
        dept = "lpad(\"Code du département\", 2, '0')"
        circo = f"{dept} || lpad(\"Code de la circonscription\", 2, '0')"
        region = region_case(dept)
        header = f"""
          SELECT {region} AS c_region, {dept} AS c_dept, {circo} AS c_circo,
                 "Libellé du département" AS lib_dept,
                 "Libellé de la circonscription" AS lib_circo,
                 {num('Inscrits')} AS ins, {num('Votants')} AS vot, {num('Exprimés')} AS exp,
                 {num('Abstentions')} AS abst, {num('Blancs')} AS blc, {num('Nuls')} AS nul
          FROM {raw}
          WHERE "Code de la circonscription" IS NOT NULL
        """
        unions = []
        for i in range(1, ncand + 1):
            nu = f'"Nuance__{i}"'
            unions.append(f"""
              SELECT {region} AS c_region, {dept} AS c_dept, {circo} AS c_circo,
                     "Nom__{i}" AS label, {nu} AS nuance,
                     {num(f'Voix__{i}')} AS voix,
                     (TRY_CAST({num(f'Sièges__{i}')} AS BIGINT) > 0) AS elu
              FROM {raw} WHERE {nu} IS NOT NULL
            """)
        cand = " UNION ALL ".join(unions)
    return header, cand


def legis_bureau_long(con, src, enc, is_csv, ncand):
    """Header + candidats au niveau commune (agrégé depuis bureaux)."""
    if is_csv:
        raw = read_raw(con, src, enc, None)
        commune = "lpad(\"Code commune\", 5, '0')"
        header = f"""
          SELECT {commune} AS c_commune, any_value("Libellé commune") AS lib_commune,
                 SUM({num('Inscrits')}) AS ins, SUM({num('Votants')}) AS vot,
                 SUM({num('Exprimés')}) AS exp, SUM({num('Abstentions')}) AS abst,
                 SUM({num('Blancs')}) AS blc, SUM({num('Nuls')}) AS nul
          FROM {raw} WHERE "Code commune" IS NOT NULL GROUP BY c_commune
        """
        unions = []
        for i in range(1, ncand + 1):
            nu = f'"Nuance candidat {i}"'
            unions.append(f"""
              SELECT {commune} AS c_commune, "Nom candidat {i}" AS label,
                     {nu} AS nuance, {num(f'Voix {i}')} AS voix
              FROM {raw} WHERE {nu} IS NOT NULL
            """)
        cand_src = " UNION ALL ".join(unions)
    else:
        names = names_clause(LEGIS22_BUREAU_BASE, LEGIS22_BUREAU_CAND, ncand)
        raw = read_raw(con, src, enc, names)
        dept = "lpad(\"Code du département\", 2, '0')"
        commune = f"{dept} || lpad(\"Code de la commune\", 3, '0')"
        header = f"""
          SELECT {commune} AS c_commune, any_value("Libellé de la commune") AS lib_commune,
                 SUM({num('Inscrits')}) AS ins, SUM({num('Votants')}) AS vot,
                 SUM({num('Exprimés')}) AS exp, SUM({num('Abstentions')}) AS abst,
                 SUM({num('Blancs')}) AS blc, SUM({num('Nuls')}) AS nul
          FROM {raw} WHERE "Code de la commune" IS NOT NULL GROUP BY c_commune
        """
        unions = []
        for i in range(1, ncand + 1):
            nu = f'"Nuance__{i}"'
            unions.append(f"""
              SELECT {commune} AS c_commune, "Nom__{i}" AS label,
                     {nu} AS nuance, {num(f'Voix__{i}')} AS voix
              FROM {raw} WHERE {nu} IS NOT NULL
            """)
        cand_src = " UNION ALL ".join(unions)
    # agrège les voix par (commune, candidat)
    cand = f"""
      SELECT c_commune, label, any_value(nuance) AS nuance, SUM(voix) AS voix, false AS elu
      FROM ({cand_src}) GROUP BY c_commune, label
    """
    return header, cand


def muni_long(con, src, enc, ncand):
    raw = read_raw(con, src, enc, None)
    dept = "lpad(\"Code département\", 2, '0')"
    commune = "lpad(\"Code commune\", 5, '0')"
    region = region_case(dept)
    header = f"""
      SELECT {region} AS c_region, {dept} AS c_dept, {commune} AS c_commune,
             "Libellé département" AS lib_dept, "Libellé commune" AS lib_commune,
             {num('Inscrits')} AS ins, {num('Votants')} AS vot, {num('Exprimés')} AS exp,
             {num('Abstentions')} AS abst, {num('Blancs')} AS blc, {num('Nuls')} AS nul
      FROM {raw} WHERE "Code commune" IS NOT NULL
    """
    unions = []
    for i in range(1, ncand + 1):
        nu = f'nullif(trim("Nuance liste {i}"), \'\')'
        lbl = (
            f'coalesce(nullif(trim("Libellé de liste {i}"), \'\'), '
            f'nullif(trim("Libellé abrégé de liste {i}"), \'\'), '
            f'nullif(trim("Nom candidat {i}"), \'\'))'
        )
        unions.append(f"""
          SELECT {region} AS c_region, {dept} AS c_dept, {commune} AS c_commune,
                 {lbl} AS label, {nu} AS nuance, {num(f'Voix {i}')} AS voix,
                 (nullif(trim("Elu {i}"), '') IS NOT NULL) AS elu
          FROM {raw} WHERE {num(f'Voix {i}')} IS NOT NULL
        """)
    cand = " UNION ALL ".join(unions)
    return header, cand


# ─── Émission des Parquet par maille ─────────────────────────────────────────

def emit(con, scrutin, header_sql, cand_sql, mailles, cand_mode):
    """cand_mode : 'nom' (présid., national) ou 'mixte' (légis/muni : nom aux
    mailles fines, nuance aux mailles agrégées)."""
    con.execute(f"CREATE OR REPLACE TEMP VIEW H AS {header_sql}")
    con.execute(f"CREATE OR REPLACE TEMP VIEW C AS {cand_sql}")

    code_expr = {
        "regions": "c_region", "departements": "c_dept",
        "circonscriptions": "c_circo", "communes": "c_commune",
    }
    fine = {"communes", "circonscriptions"}  # mailles où le candidat reste individuel

    terr_parts, cand_parts = [], []
    hcols = {r[0] for r in con.execute("DESCRIBE H").fetchall()}
    ccols = {r[0] for r in con.execute("DESCRIBE C").fetchall()}

    for m in mailles:
        ce = code_expr[m]
        if ce not in hcols:
            continue
        # libellé du territoire : nom de région via map, sinon libellé source si présent
        lib_col = {"departements": "lib_dept", "circonscriptions": "lib_circo",
                   "communes": "lib_commune"}.get(m)
        if m == "regions":
            ne = region_name_case("c_region")
        elif lib_col and lib_col in hcols:
            ne = f"any_value({lib_col})"
        else:
            ne = "NULL"
        terr_parts.append(f"""
          SELECT '{m}' AS maille, {ce} AS code, {ne} AS libelle,
                 SUM(ins) AS inscrits, SUM(vot) AS votants, SUM(exp) AS exprimes,
                 SUM(abst) AS abstentions, SUM(blc) AS blancs, SUM(nul) AS nuls
          FROM H WHERE {ce} IS NOT NULL GROUP BY {ce}
        """)
        if ce not in ccols:
            continue
        individual = (cand_mode == "nom") or (m in fine)
        if individual:
            cand_parts.append(f"""
              SELECT '{m}' AS maille, {ce} AS code, label,
                     any_value(nuance) AS nuance, SUM(voix) AS voix, bool_or(elu) AS elu
              FROM C WHERE {ce} IS NOT NULL AND label IS NOT NULL
              GROUP BY {ce}, label
            """)
        else:
            cand_parts.append(f"""
              SELECT '{m}' AS maille, {ce} AS code, NULL AS label,
                     nuance, SUM(voix) AS voix, false AS elu
              FROM C WHERE {ce} IS NOT NULL AND nuance IS NOT NULL
              GROUP BY {ce}, nuance
            """)

    OUT.mkdir(parents=True, exist_ok=True)
    terr_out = OUT / f"{scrutin}_territoires.parquet"
    cand_out = OUT / f"{scrutin}_candidats.parquet"
    con.execute(f"""COPY ({' UNION ALL '.join(terr_parts)})
                    TO '{terr_out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)""")
    con.execute(f"""COPY ({' UNION ALL '.join(cand_parts)})
                    TO '{cand_out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD)""")
    nt = con.execute(f"SELECT COUNT(*) FROM read_parquet('{terr_out.as_posix()}')").fetchone()[0]
    nc = con.execute(f"SELECT COUNT(*) FROM read_parquet('{cand_out.as_posix()}')").fetchone()[0]
    print(f"  ✓ {scrutin}: {nt} territoires, {nc} lignes candidats")


def main() -> int:
    try:
        import duckdb
    except ImportError:
        print("✗ pip3 install duckdb requis", file=sys.stderr)
        return 1
    con = duckdb.connect()
    con.execute("SET TimeZone='UTC'; PRAGMA threads=4;")

    # ── Présidentielles ──────────────────────────────────────────────────────
    presid = [
        ("presid-2017-t1", "presidentielle_2017_t1.txt", "latin-1", 11, 2017),
        ("presid-2017-t2", "presidentielle_2017_t2.txt", "latin-1", 2, 2017),
        ("presid-2022-t1", "presidentielle_2022_t1.txt", "latin-1", 12, 2022),
        ("presid-2022-t2", "presidentielle_2022_t2.txt", "latin-1", 2, 2022),
    ]
    for scrutin, fname, enc, _ncand, year in presid:
        src = RAW / fname
        if not src.exists():
            print(f"  ⚠ {scrutin}: source manquante {fname}"); continue
        ncand = (scan_maxcols(src, enc) - len(PRESID_BASE)) // len(PRESID_CAND)
        print(f"→ {scrutin} ({ncand} candidats)")
        header, cand, mailles, mode = presid_long(con, src, enc, ncand, year)
        emit(con, scrutin, header, cand, mailles, mode)

    # ── Législatives ─────────────────────────────────────────────────────────
    legis = [
        ("legis-2022-t1", "legislatives_2022_t1_circo.txt", "legislatives_2022_t1_bureau.txt",
         "latin-1", False),
        ("legis-2022-t2", "legislatives_2022_t2_circo.txt", "legislatives_2022_t2_bureau.txt",
         "latin-1", False),
        ("legis-2024-t1", "legislatives_2024_t1_circo.csv", "legislatives_2024_t1_bureau.csv",
         "utf-8", True),
        ("legis-2024-t2", "legislatives_2024_t2_circo.csv", "legislatives_2024_t2_bureau.csv",
         "utf-8", True),
    ]
    for scrutin, circo_f, bureau_f, enc, is_csv in legis:
        csrc, bsrc = RAW / circo_f, RAW / bureau_f
        if not csrc.exists() or not bsrc.exists():
            print(f"  ⚠ {scrutin}: source manquante"); continue
        if is_csv:
            ncirco = count_named(csrc, enc, "Nuance candidat")
            nbureau = count_named(bsrc, enc, "Nuance candidat")
        else:
            ncirco = (scan_maxcols(csrc, enc) - len(LEGIS22_CIRCO_BASE)) // len(LEGIS22_CIRCO_CAND)
            nbureau = (scan_maxcols(bsrc, enc) - len(LEGIS22_BUREAU_BASE)) // len(LEGIS22_BUREAU_CAND)
        print(f"→ {scrutin} (circo {ncirco}, bureau {nbureau} cand.)")
        h_circo, c_circo = legis_circo_long(
            con, csrc, enc, is_csv, ncirco, LEGIS22_CIRCO_BASE, LEGIS22_CIRCO_CAND)
        h_bureau, c_bureau = legis_bureau_long(con, bsrc, enc, is_csv, nbureau)
        # header : circo pour reg/dept/circo, bureau pour communes
        header = f"""
          SELECT c_region, c_dept, c_circo, NULL AS c_commune,
                 lib_dept, lib_circo, NULL AS lib_commune, ins, vot, exp, abst, blc, nul
          FROM ({h_circo})
          UNION ALL BY NAME
          SELECT NULL AS c_region, NULL AS c_dept, NULL AS c_circo, c_commune,
                 NULL AS lib_dept, NULL AS lib_circo, lib_commune, ins, vot, exp, abst, blc, nul
          FROM ({h_bureau})
        """
        cand = f"""
          SELECT c_region, c_dept, c_circo, NULL AS c_commune, label, nuance, voix, elu
          FROM ({c_circo})
          UNION ALL BY NAME
          SELECT NULL AS c_region, NULL AS c_dept, NULL AS c_circo, c_commune, label, nuance, voix, elu
          FROM ({c_bureau})
        """
        emit(con, scrutin, header, cand,
             ["regions", "departements", "circonscriptions", "communes"], "mixte")

    # ── Municipales ──────────────────────────────────────────────────────────
    muni = [
        ("municipales-2026-t1", "municipales_2026_t1_commune.csv"),
        ("municipales-2026-t2", "municipales_2026_t2_commune.csv"),
    ]
    for scrutin, fname in muni:
        src = RAW / fname
        if not src.exists():
            print(f"  ⚠ {scrutin}: source manquante {fname}"); continue
        ncand = count_named(src, "utf-8", "Nuance liste")
        print(f"→ {scrutin} ({ncand} listes)")
        header, cand = muni_long(con, src, enc="utf-8", ncand=ncand)
        emit(con, scrutin, header, cand,
             ["regions", "departements", "communes"], "mixte")

    print("\n✓ Agrégats produits dans public/electoral/agg/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
