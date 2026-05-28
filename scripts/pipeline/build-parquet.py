#!/usr/bin/env python3
"""
Convertit les CSV/TXT électoraux bruts en Parquet, en utilisant DuckDB.
- présidentielle 2022 T1 + T2 par bureau de vote
- législatives 2024 T1 + T2 par bureau de vote
- législatives 2024 T1 par circonscription

Le format MinInt est large (« wide ») : 1 ligne par bureau, candidats déclinés en colonnes.
On garde le format brut pour Parquet — la normalisation long-format se fait côté DuckDB-WASM
au moment de la requête (column pruning + predicate pushdown).
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw" / "electoral"
OUT = ROOT / "public" / "electoral"
SOURCES = ROOT / "scripts" / "pipeline" / "sources.json"


def have_duckdb() -> bool:
    try:
        subprocess.run(["duckdb", "--version"], check=True, capture_output=True)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def have_python_duckdb() -> bool:
    try:
        import duckdb  # noqa: F401
        return True
    except ImportError:
        return False


# Pour les fichiers MinInt présidentielle 2022, le header est court : il ne
# nomme qu'une seule fois le bloc candidat. DuckDB renomme alors les colonnes
# suivantes en "columnNNN". On précise un schéma explicite ici pour avoir
# "Nom_2", "Voix_2", … directement utilisables.
CANDIDATE_FIELDS = (
    "N°Panneau",
    "Sexe",
    "Nom",
    "Prénom",
    "Voix",
    "% Voix/Ins",
    "% Voix/Exp",
)
PRESID_BUREAU_FIELDS = (
    "Code du département",
    "Libellé du département",
    "Code de la circonscription",
    "Libellé de la circonscription",
    "Code de la commune",
    "Libellé de la commune",
    "Code du b.vote",
    "Inscrits",
    "Abstentions",
    "% Abs/Ins",
    "Votants",
    "% Vot/Ins",
    "Blancs",
    "% Blancs/Ins",
    "% Blancs/Vot",
    "Nuls",
    "% Nuls/Ins",
    "% Nuls/Vot",
    "Exprimés",
    "% Exp/Ins",
    "% Exp/Vot",
)
N_CANDIDATS_PRESID = {
    "presidentielle_2022_t1": 12,
    "presidentielle_2022_t2": 2,
}


def presid_column_names(key: str) -> list[str] | None:
    n = N_CANDIDATS_PRESID.get(key)
    if not n:
        return None
    cols = list(PRESID_BUREAU_FIELDS)
    for i in range(1, n + 1):
        for f in CANDIDATE_FIELDS:
            cols.append(f"{f}_{i}")
    return cols


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    sources = json.loads(SOURCES.read_text())

    if not have_python_duckdb():
        print(
            "✗ Le package Python `duckdb` est requis.\n"
            "  Installe-le : pip3 install duckdb",
            file=sys.stderr,
        )
        return 1

    import duckdb

    con = duckdb.connect()
    con.execute("SET TimeZone='UTC';")

    for key, meta in sources["electoral"].items():
        fmt = meta["format"]
        ext = "csv" if "csv" in fmt else "txt"
        src = RAW / f"{key}.{ext}"
        if not src.exists():
            print(f"✗ source manquante: {src} (run download.sh d'abord)")
            continue

        out = OUT / f"{key}.parquet"
        encoding = "latin-1" if "latin1" in fmt else "utf-8"

        print(f"→ {key}  ({src.stat().st_size / 1e6:.1f} MB → parquet)")

        # Largeur variable : 1 ligne par bureau, candidats appendus en fin
        # de ligne. `null_padding=true` aligne sur le row le plus large ;
        # `all_varchar=true` évite les surprises de typage. La normalisation
        # long-format est faite côté DuckDB-WASM au moment de la requête.
        # Pour la présidentielle 2022, on force un schéma de colonnes avec
        # suffixes _1, _2, … sinon DuckDB nomme columnNNN les blocs candidats
        # 2-N (le header MinInt ne nomme qu'une fois le bloc).
        names_clause = ""
        skip_clause = "header=true,"
        names = presid_column_names(key)
        if names:
            names_str = ", ".join(f"'{n.replace(chr(39), chr(39)+chr(39))}'" for n in names)
            names_clause = f"names=[{names_str}],"
            skip_clause = "header=true,"  # toujours sauter la 1re ligne d'en-tête

        con.execute(
            f"""
            COPY (
              SELECT *
              FROM read_csv(
                '{src.as_posix()}',
                sep=';',
                encoding='{encoding}',
                {skip_clause}
                {names_clause}
                all_varchar=true,
                null_padding=true,
                ignore_errors=true
              )
            )
            TO '{out.as_posix()}' (FORMAT PARQUET, COMPRESSION ZSTD);
            """
        )

        size_mb = out.stat().st_size / 1e6
        print(f"  ✓ {size_mb:.1f} MB → {out.relative_to(ROOT)}")

    print()
    print("✓ Parquet produits dans data/electoral/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
