#!/usr/bin/env python3
"""
Parse les PDF des notices de la Commission des sondages pour en extraire les
données (méthodologie + intentions). Enrichit public/sondages/notices.json.

À exécuter APRÈS build-cncs-notices.py (qui produit la liste des notices).

Stratégie :
  - Méthodologie (échantillon, effectif utile, méthode, dates terrain) :
    extraction FIABLE par motifs, cohérente entre instituts.
  - Intentions de vote : best-effort, uniquement sous un titre « Intentions de
    vote » explicite (lignes « libellé … X,X% [Y,Y%] »). Marqué comme
    auto-extrait ; la notice PDF reste la source de vérité.

Incrémental : un cache (parse-cache.json, clé = n° de notice) évite de
re-télécharger/re-parser les PDF déjà traités. Seules les nouvelles notices
sont parsées à chaque exécution → MAJ quotidienne légère.

Dépendance : pdfplumber (installée dans le workflow CI).
"""
from __future__ import annotations

import io
import json
import re
import sys
import urllib.request
from pathlib import Path

try:
    import pdfplumber
except ImportError:
    print("✗ pdfplumber manquant (pip install pdfplumber)", file=sys.stderr)
    raise SystemExit(1)

ROOT = Path(__file__).resolve().parents[2]
NOTICES = ROOT / "public" / "sondages" / "notices.json"
# Cache de build (hors /public : pas servi au client). Persisté dans le repo
# pour l'incrémental — seules les nouvelles notices sont parsées à chaque run.
CACHE = Path(__file__).resolve().parent / "parse-cache.json"

NBSP = "   "


def norm(s: str) -> str:
    return re.sub("[" + NBSP + "]", " ", s)


def to_int(s: str) -> int:
    return int(re.sub(r"\s", "", s))


def parse_sample(t: str) -> tuple[int | None, int | None]:
    t2 = norm(t)
    n = None
    for rx in (
        r"échantillon(?:\s+\w+){0,2}\s+de\s+([\d ]{2,7})",
        r"(?:repr[ée]sentatif|aupr[èe]s)\s+de\s+([\d ]{3,7})\s+(?:fran[çc]ais|personnes|inscrits)",
        r"\bde\s+([\d ]{3,7})\s+personnes\s+(?:inscrites|repr[ée]sentati)",
    ):
        m = re.search(rx, t2, re.I)
        if m:
            n = to_int(m.group(1))
            break
    me = re.search(r"effectif\s+utile\s+(?:est\s+)?de\s+([\d ]{2,7})", t2, re.I)
    eff = to_int(me.group(1)) if me else None
    return n, eff


def parse_method(t: str) -> str | None:
    low = t.lower()
    if re.search(r"en ligne|auto-administr|internet|\bonline\b|cawi", low):
        return "En ligne"
    if re.search(r"t[ée]l[ée]phon|cati", low):
        return "Téléphone"
    if re.search(r"face[- ]à[- ]face|\bcapi\b", low):
        return "Face-à-face"
    return None


def parse_terrain(t: str) -> str | None:
    t2 = norm(t)
    m = (
        re.search(r"interviews?\s+r[ée]alis[ée]s?\s+(.{3,45}?20\d{2})", t2, re.I)
        or re.search(r"r[ée]alis[ée]s?\s+du\s+(.{3,40}?20\d{2})", t2, re.I)
        or re.search(r"\bdu\s+(\d{1,2}[^.]{2,38}?20\d{2})", t2, re.I)
    )
    return re.sub(r"\s+", " ", m.group(1)).strip() if m else None


# ── Intentions de vote (best-effort) ────────────────────────────────────────

PCT = re.compile(r"(\d{1,2}(?:[.,]\d)?)\s*%")
# Titre de section (début de ligne, court) — pas une phrase de méthodo.
HEADING = re.compile(r"^\s*intentions?\s+de\s+vote\b", re.I)
STOP = re.compile(r"©|calcul|participation|marge d'erreur|structure|pr[ée]cision|annexe", re.I)
LABEL_NOISE = re.compile(r"^(brut\s+redress[ée]|brut|redress[ée])\s*", re.I)


def parse_intentions(t: str) -> list[dict]:
    lines = [re.sub(r"\s+", " ", l).strip() for l in norm(t).split("\n")]
    out: list[dict] = []
    i = 0
    started = False
    label_buf: list[str] = []
    while i < len(lines):
        line = lines[i]
        if not started:
            if HEADING.match(line) and len(line) < 60:
                started = True
            i += 1
            continue
        if not line:
            i += 1
            continue
        if STOP.search(line) and not PCT.search(line):
            break
        pcts = PCT.findall(line)
        if pcts:
            # libellé = texte avant le 1er % sur la ligne, sinon le buffer
            before = line[: line.find(pcts[0])].strip(" .–-")
            label = before if len(before) > 3 else " ".join(label_buf).strip()
            label = LABEL_NOISE.sub("", re.sub(r"\s+", " ", label).strip(" .–-"))
            vals = [float(p.replace(",", ".")) for p in pcts[:2]]
            if label and 0 <= vals[0] <= 100:
                out.append(
                    {
                        "label": label[:160],
                        "brut": vals[0],
                        "redresse": vals[1] if len(vals) > 1 else None,
                    }
                )
            label_buf = []
        else:
            label_buf.append(line)
            label_buf = label_buf[-3:]
        i += 1
        if len(out) >= 30:
            break
    # Garde-fou : on ne renvoie que si ça ressemble à des intentions plausibles.
    if len(out) < 2:
        return []
    return out


def fetch_pdf_text(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (MOUVANCIA pipeline)"})
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = r.read()
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            return "\n".join((p.extract_text() or "") for p in pdf.pages)
    except Exception as e:  # noqa: BLE001
        print(f"  ! échec {url}: {e}", file=sys.stderr)
        return None


def parse_one(text: str) -> dict:
    sample, eff = parse_sample(text)
    intentions = parse_intentions(text)
    return {
        "echantillon": sample,
        "effectif_utile": eff,
        "methode": parse_method(text),
        "terrain": parse_terrain(text),
        "intentions": intentions,
        "n_pages_chars": len(text),
    }


def main() -> int:
    if not NOTICES.exists():
        print("✗ notices.json absent — lancer build-cncs-notices.py d'abord", file=sys.stderr)
        return 1
    data = json.loads(NOTICES.read_text())
    cache: dict[str, dict] = json.loads(CACHE.read_text()) if CACHE.exists() else {}

    parsed_now = 0
    for n in data["notices"]:
        key = n.get("numero") or n.get("pdf")
        if not key:
            continue
        if key not in cache:
            text = fetch_pdf_text(n["pdf"])
            if text is None:
                continue
            cache[key] = parse_one(text)
            parsed_now += 1
            if parsed_now % 20 == 0:
                print(f"  … {parsed_now} PDF parsés")
        # Fusionne les champs extraits dans la notice.
        d = cache[key]
        n["echantillon"] = d.get("echantillon")
        n["effectif_utile"] = d.get("effectif_utile")
        n["methode"] = d.get("methode")
        n["terrain"] = d.get("terrain")
        n["intentions"] = d.get("intentions") or []

    CACHE.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")))
    NOTICES.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))

    n_with_sample = sum(1 for n in data["notices"] if n.get("echantillon"))
    n_with_int = sum(1 for n in data["notices"] if n.get("intentions"))
    print(f"  ✓ {parsed_now} nouveaux PDF parsés ; {n_with_sample}/{len(data['notices'])} avec échantillon, {n_with_int} avec intentions")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
