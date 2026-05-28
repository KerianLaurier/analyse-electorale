#!/usr/bin/env python3
"""
Scrape le registre des notices de la Commission des sondages (CNCS).

Source légale : avant toute publication d'un sondage électoral, l'institut
dépose une notice auprès de la CNCS, publiée sur commission-des-sondages.fr.
C'est la seule source *vivante* et exhaustive des sondages français.

- input  : https://www.commission-des-sondages.fr/notices/ (HTML)
- output : public/sondages/notices.json
           (notices classées par scrutin : n°, institut, média, date, lien PDF)

NB : les chiffres d'intentions sont dans les PDF (formats hétérogènes par
institut). Le parsing PDF sera traité dans un second temps. Ici on produit le
flux fiable des notices, classées par scrutin.
"""
from __future__ import annotations

import html as html_lib
import json
import re
import sys
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "sondages" / "notices.json"
BASE = "https://www.commission-des-sondages.fr"
SRC_URL = f"{BASE}/notices/"

# Préfixes de scrutin utilisés par la CNCS dans le libellé des notices.
SCRUTIN_RULES: list[tuple[re.Pattern, str, str]] = [
    (re.compile(r"\bpr[eé]s", re.I), "presidentielle", "Présidentielle 2027"),
    (re.compile(r"\bmun", re.I), "municipales", "Municipales 2026"),
    (re.compile(r"\bl[eé]g", re.I), "legislatives", "Législatives"),
    (re.compile(r"\beuro", re.I), "europeennes", "Européennes"),
    (re.compile(r"\br[eé]g", re.I), "regionales", "Régionales"),
    (re.compile(r"\bd[eé]p", re.I), "departementales", "Départementales"),
    (re.compile(r"\bs[eé]nat", re.I), "senatoriales", "Sénatoriales"),
    (re.compile(r"r[eé]f[eé]rendum", re.I), "referendum", "Référendum"),
]

# Instituts connus → (motif détecté en MAJUSCULES, nom canonique affiché).
# Motifs les plus longs en premier pour un matching glouton correct.
INSTITUTS: list[tuple[str, str]] = [
    ("TOLUNA HARRIS INTERACTIVE", "Harris Interactive"),
    ("HARRIS INTERACTIVE", "Harris Interactive"),
    ("HARRIS", "Harris Interactive"),
    ("KANTAR PUBLIC", "Kantar"),
    ("KANTAR", "Kantar"),
    ("IPSOS BVA", "Ipsos"),
    ("IPSOS", "Ipsos"),
    ("OPINION WAY", "OpinionWay"),
    ("OPINIONWAY", "OpinionWay"),
    ("CLUSTER 17", "Cluster17"),
    ("CLUSTER17", "Cluster17"),
    ("IFOP", "Ifop"),
    ("ELABE", "Elabe"),
    ("YOUGOV", "YouGov"),
    ("VERIAN", "Verian"),
    ("ODOXA", "Odoxa"),
    ("TOLUNA", "Harris Interactive"),
    ("CSA", "CSA"),
    ("BVA", "BVA"),
]

MONTHS = {
    "janvier": 1, "février": 2, "fevrier": 2, "mars": 3, "avril": 4,
    "mai": 5, "juin": 6, "juillet": 7, "août": 8, "aout": 8,
    "septembre": 9, "octobre": 10, "novembre": 11, "décembre": 12, "decembre": 12,
}


def classify(label: str) -> tuple[str, str]:
    for rx, code, name in SCRUTIN_RULES:
        if rx.search(label):
            return code, name
    return "autre", "Autre / popularité"


def detect_institut(label: str) -> str | None:
    up = label.upper()
    for pattern, canonical in INSTITUTS:
        if pattern in up:
            return canonical
    return None


def parse_date(label: str, fallback_year: int) -> tuple[str | None, int | None]:
    """Renvoie (iso, mois) à partir de '... 26 mai'. Année devinée."""
    m = re.search(r"(\d{1,2})\s+(" + "|".join(MONTHS) + r")", label, re.I)
    if not m:
        return None, None
    day = int(m.group(1))
    month = MONTHS[m.group(2).lower()]
    iso = f"{fallback_year:04d}-{month:02d}-{day:02d}"
    return iso, month


def main() -> int:
    print(f"→ Scrape CNCS ({SRC_URL})")
    try:
        req = urllib.request.Request(SRC_URL, headers={"User-Agent": "Mozilla/5.0 (MOUVANCIA pipeline)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            page = r.read().decode("utf-8", errors="replace")
    except Exception as e:  # noqa: BLE001
        print(f"✗ échec scrape : {e}", file=sys.stderr)
        return 1

    # Chaque notice : <a href="/notices/medias/fichiers/add/NNNN" ...>LABEL</a>
    rows = re.findall(
        r'<a href="(/notices/[^"]+?)"[^>]*class="pdf_download"[^>]*>([^<]+)</a>',
        page,
    )
    if not rows:
        # Fallback : tous les liens de notices
        rows = re.findall(r'<a href="(/notices/medias/fichiers/[^"]+)"[^>]*>([^<]+)</a>', page)

    now = datetime.now(timezone.utc)
    year = now.year
    prev_month = now.month

    notices = []
    for href, raw_label in rows:
        label = html_lib.unescape(raw_label).strip()
        label = re.sub(r"\s+", " ", label)
        if not label:
            continue

        # n° (premier entier du libellé)
        num_m = re.match(r"(\d{3,6})\b", label)
        numero = num_m.group(1) if num_m else None
        text = label[num_m.end():].strip() if num_m else label

        scrutin_code, scrutin_name = classify(text)
        institut = detect_institut(text)

        # Datation : les notices sont listées de la plus récente à la plus
        # ancienne → on décrémente l'année au passage d'une frontière de mois.
        iso, month = parse_date(text, year)
        if month is not None:
            if month > prev_month + 1:  # ex. passage mai(5) → décembre(12)
                year -= 1
                iso = f"{year:04d}-{month:02d}-{int(re.search(r'(\d{1,2})', text).group(1)):02d}"
            prev_month = month

        notices.append(
            {
                "numero": numero,
                "label": text,
                "scrutin": scrutin_code,
                "scrutin_label": scrutin_name,
                "institut": institut,
                "date": iso,
                "pdf": BASE + href,
            }
        )

    # Comptage par scrutin
    by_scrutin: dict[str, int] = {}
    for n in notices:
        by_scrutin[n["scrutin"]] = by_scrutin.get(n["scrutin"], 0) + 1

    out = {
        "source": "Commission des sondages",
        "source_url": SRC_URL,
        "license": "Registre public — Commission des sondages",
        "generated_at": now.isoformat(),
        "n_notices": len(notices),
        "by_scrutin": by_scrutin,
        "notices": notices,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"  ✓ {len(notices)} notices ({size_kb:.0f} KB) → {OUT.relative_to(ROOT)}")
    print(f"    par scrutin : {by_scrutin}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
