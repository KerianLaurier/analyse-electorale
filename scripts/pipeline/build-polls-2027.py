#!/usr/bin/env python3
"""
Agrège les intentions de vote du 1er tour de la présidentielle 2027 depuis la
page Wikipédia FR « Liste de sondages sur l'élection présidentielle française
de 2027 » (tableaux structurés : sondeur, date, échantillon, % par candidat).

Pourquoi cette source : les notices techniques de la Commission des sondages ne
contiennent PAS les chiffres d'intentions (déposés uniquement dans l'article
média). Wikipédia agrège ces chiffres avec le sondeur par ligne — ce qui permet
des courbes d'évolution « même institut, même donnée » (méthodologiquement
correctes : pas de mélange d'effets de maison).

output : public/sondages/polls-2027.json

Dépendances : pandas, lxml (installées dans le workflow CI).
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from io import StringIO
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("✗ pandas/lxml manquants (pip install pandas lxml)", file=sys.stderr)
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sondages" / "polls-2027.json"
TITLE = "Liste de sondages sur l'élection présidentielle française de 2027"
API = "https://fr.wikipedia.org/w/api.php?action=parse&format=json&prop=text&page=" + urllib.parse.quote(TITLE)
PAGE_URL = "https://fr.wikipedia.org/wiki/" + urllib.parse.quote(TITLE.replace(" ", "_"))

MONTHS = {
    "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4, "mai": 5,
    "juin": 6, "juillet": 7, "août": 8, "aout": 8, "septembre": 9,
    "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12,
}

# Normalise les noms d'instituts (variantes Wikipédia → canonique).
INSTITUT_CANON = {
    "ifop": "Ifop", "ifop-fiducial": "Ifop", "elabe": "Elabe", "odoxa": "Odoxa",
    "ipsos": "Ipsos", "opinionway": "OpinionWay", "harris interactive": "Harris Interactive",
    "harris-interactive": "Harris Interactive", "harris": "Harris Interactive",
    "cluster17": "Cluster17", "cluster 17": "Cluster17",
    "kantar": "Kantar", "yougov": "YouGov", "verian": "Verian", "csa": "CSA", "bva": "BVA",
}
# Whitelist : seules ces lignes sont des sondages (Wikipédia intercale des
# lignes « évènement » — nominations, candidatures… — qu'on doit ignorer).
KNOWN_INSTITUTS = set(INSTITUT_CANON.values())


def clean_candidate(name: str) -> str:
    name = re.sub(r"\[[a-z0-9]\]", "", str(name))  # retire les renvois [c]
    return name.strip()


def parse_value(raw) -> float | None:
    s = str(raw).strip()
    if s in ("", "—", "-", "–", "nan", "None"):
        return None
    # "34 Bardella" → 34 ; "11.5" déjà ok ; garde le 1er nombre
    m = re.search(r"\d{1,2}(?:[.,]\d)?", s)
    if not m:
        return None
    v = float(m.group(0).replace(",", "."))
    return v if 0 <= v <= 100 else None


def parse_date(raw: str, default_year: int) -> str | None:
    s = re.sub(r"\s+", " ", str(raw)).strip().lower()
    ym = re.search(r"\b(20\d{2})\b", s)
    year = int(ym.group(1)) if ym else default_year
    mm = re.search(r"(" + "|".join(MONTHS) + r")", s)
    if not mm:
        return None
    month = MONTHS[mm.group(1)]
    # dernier jour de la fourchette (« 26-28 mai » → 28)
    days = re.findall(r"\b(\d{1,2})\b", s[: mm.start()])
    day = int(days[-1]) if days else 1
    if not (1 <= day <= 31):
        day = 1
    return f"{year:04d}-{month:02d}-{day:02d}"


def canon_institut(name: str) -> str:
    base = re.sub(r"\[[a-z0-9]\]", "", str(name)).strip()
    return INSTITUT_CANON.get(base.lower(), base)


def main() -> int:
    print(f"→ Wikipédia : {TITLE}")
    try:
        req = urllib.request.Request(API, headers={"User-Agent": "Mozilla/5.0 (MOUVANCIA pipeline)"})
        html = json.loads(urllib.request.urlopen(req, timeout=60).read())["parse"]["text"]["*"]
    except Exception as e:  # noqa: BLE001
        print(f"✗ échec récupération Wikipédia : {e}", file=sys.stderr)
        return 1

    tables = pd.read_html(StringIO(html), decimal=",", thousands="\xa0")

    polls: list[dict] = []
    candidates: list[str] = []
    now = datetime.now(timezone.utc)
    first_tour_idx = 0  # tables 1er tour dans l'ordre = années décroissantes

    for t in tables:
        cols = list(t.columns)
        if len(cols) < 6:
            continue
        # 1er tour : 2e colonne = « Date » (singulier) ; 2nd tour = « Dates ».
        col1 = str(cols[1][1] if isinstance(cols[1], tuple) else cols[1])
        if col1.strip().lower() != "date":
            continue
        # Année par défaut = année courante pour la 1ère table 1er tour, puis
        # décroissante (sections « Année 2026 / 2025 / 2024 / 2023 »). Les
        # lignes qui portent une année explicite la priorisent.
        table_year = now.year - first_tour_idx
        first_tour_idx += 1
        cand_cols = cols[3:]
        names = [clean_candidate(c[1] if isinstance(c, tuple) else c) for c in cand_cols]
        if not candidates:
            candidates = names

        for _, row in t.iterrows():
            vals = row.tolist()
            sondeur_raw = str(vals[0]).strip()
            institut = canon_institut(sondeur_raw)
            # Ignore les lignes « évènement » et les sondeurs inconnus.
            if institut not in KNOWN_INSTITUTS:
                continue
            date = parse_date(vals[1], table_year)
            if not date:
                continue
            valeurs = {}
            for i, nm in enumerate(names):
                v = parse_value(vals[3 + i])
                if v is not None:
                    valeurs[nm] = v
            if not valeurs:
                continue
            ech = parse_value(vals[2])  # échantillon (peut être None)
            ech_m = re.search(r"\d[\d ]{2,6}", str(vals[2]).replace("\xa0", " "))
            polls.append(
                {
                    "sondeur": institut,
                    "date": date,
                    "echantillon": int(re.sub(r"\s", "", ech_m.group(0))) if ech_m else None,
                    "valeurs": valeurs,
                }
            )

    # Déduplique (même sondeur+date+valeurs) et trie par date.
    seen = set()
    uniq = []
    for p in sorted(polls, key=lambda x: x["date"]):
        k = (p["sondeur"], p["date"], tuple(sorted(p["valeurs"].items())))
        if k in seen:
            continue
        seen.add(k)
        uniq.append(p)

    instituts = sorted({p["sondeur"] for p in uniq})
    out = {
        "source": "Wikipédia (agrégation) — sondages présidentielle 2027, 1er tour",
        "source_url": PAGE_URL,
        "generated_at": now.isoformat(),
        "candidates": candidates,
        "instituts": instituts,
        "n_polls": len(uniq),
        "polls": uniq,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"  ✓ {len(uniq)} sondages 1er tour ({len(instituts)} instituts) → {OUT.relative_to(ROOT)}")
    print(f"    instituts : {instituts}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
