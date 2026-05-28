#!/usr/bin/env python3
"""
Veille média — agrège les flux RSS politique des grands titres français.

- sources : Le Monde, Le Figaro, Libération, France Info (rubriques politique)
- output  : public/suivi/veille.json (articles récents, tous flux confondus)

Module 8 du brief (veille et actualité). Le filtrage par circonscription /
candidat pourra être ajouté ensuite (matching sur titre/description).
"""
from __future__ import annotations

import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "suivi" / "veille.json"
KEEP = 60

FEEDS = [
    ("Le Monde", "https://www.lemonde.fr/politique/rss_full.xml"),
    ("Le Figaro", "https://www.lefigaro.fr/rss/figaro_politique.xml"),
    ("Libération", "https://www.liberation.fr/arc/outboundfeeds/rss/category/politique/?outputType=xml"),
    ("France Info", "https://www.francetvinfo.fr/politique.rss"),
]

TAG_RX = re.compile(r"<[^>]+>")
WS_RX = re.compile(r"\s+")


def clean(text: str | None) -> str:
    if not text:
        return ""
    text = TAG_RX.sub(" ", text)
    text = text.replace("&nbsp;", " ").replace("&#39;", "'").replace("&amp;", "&")
    return WS_RX.sub(" ", text).strip()


def parse_date(s: str | None) -> str | None:
    if not s:
        return None
    try:
        dt = parsedate_to_datetime(s)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    except (TypeError, ValueError):
        return None


def fetch_feed(source: str, url: str) -> list[dict]:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (MOUVANCIA pipeline)"})
        with urllib.request.urlopen(req, timeout=30) as r:
            root = ET.fromstring(r.read())
    except Exception as e:  # noqa: BLE001
        print(f"  ⚠ {source}: {e}", file=sys.stderr)
        return []

    out = []
    for item in root.findall(".//item"):
        title = clean(item.findtext("title"))
        link = (item.findtext("link") or "").strip()
        if not title or not link:
            continue
        desc = clean(item.findtext("description"))
        out.append(
            {
                "source": source,
                "titre": title,
                "lien": link,
                "resume": desc[:280],
                "date": parse_date(item.findtext("pubDate")),
            }
        )
    return out


def main() -> int:
    print("→ Agrégation veille RSS")
    articles: list[dict] = []
    for source, url in FEEDS:
        items = fetch_feed(source, url)
        print(f"  · {source}: {len(items)} articles")
        articles.extend(items)

    # Dédoublonnage par lien, tri par date décroissante.
    seen = set()
    uniq = []
    for a in sorted(articles, key=lambda x: x["date"] or "", reverse=True):
        if a["lien"] in seen:
            continue
        seen.add(a["lien"])
        uniq.append(a)
    recent = uniq[:KEEP]

    out = {
        "source": "Flux RSS — Le Monde, Le Figaro, Libération, France Info",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n": len(recent),
        "articles": recent,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"  ✓ {len(recent)} articles — {size_kb:.0f} KB → {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
