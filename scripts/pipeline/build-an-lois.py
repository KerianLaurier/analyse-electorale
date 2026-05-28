#!/usr/bin/env python3
"""
Dossiers législatifs (lois & propositions de loi) — Assemblée nationale 17e.

- source : data.assemblee-nationale.fr — Dossiers_Legislatifs.json.zip
- output : public/suivi/lois.json (les N dossiers les plus récents)

On extrait : titre, type (PJL/PPL), initiateur, et la date d'acte la plus
récente (scan récursif de l'arbre actesLegislatifs) pour trier par actualité.
"""
from __future__ import annotations

import io
import json
import re
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "suivi" / "lois.json"
SRC_URL = "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/dossiers_legislatifs/Dossiers_Legislatifs.json.zip"
KEEP = 150

DATE_RX = re.compile(r"\b(20\d{2}-\d{2}-\d{2})\b")


def max_date(obj) -> str | None:
    """Renvoie la date ISO maximale trouvée récursivement dans la structure."""
    best: str | None = None
    stack = [obj]
    while stack:
        cur = stack.pop()
        if isinstance(cur, dict):
            stack.extend(cur.values())
        elif isinstance(cur, list):
            stack.extend(cur)
        elif isinstance(cur, str):
            m = DATE_RX.match(cur)
            if m and (best is None or cur[:10] > best):
                best = cur[:10]
    return best


def main() -> int:
    print("→ Téléchargement dossiers législatifs AN (17e)")
    try:
        req = urllib.request.Request(SRC_URL, headers={"User-Agent": "MOUVANCIA pipeline"})
        with urllib.request.urlopen(req, timeout=120) as r:
            blob = r.read()
    except Exception as e:  # noqa: BLE001
        print(f"✗ téléchargement échoué : {e}", file=sys.stderr)
        return 1

    lois = []
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        names = [
            n for n in z.namelist()
            if "dossierParlementaire" in n and n.endswith(".json")
        ]
        for name in names:
            try:
                dp = json.loads(z.read(name)).get("dossierParlementaire", {})
            except Exception:  # noqa: BLE001
                continue
            titre = (dp.get("titreDossier") or {}).get("titre")
            if not titre:
                continue
            proc = dp.get("procedureParlementaire") or {}
            initiateur = dp.get("initiateur") or {}
            # Initiateur : peut contenir acteurs/organes ; on garde un libellé court.
            init_txt = None
            if isinstance(initiateur, dict):
                acteurs = initiateur.get("acteurs")
                if isinstance(acteurs, dict):
                    acteurs = acteurs.get("acteur")
                if isinstance(acteurs, list) and acteurs:
                    init_txt = "Initiative parlementaire"
                elif acteurs:
                    init_txt = "Initiative parlementaire"
            lois.append(
                {
                    "uid": dp.get("uid"),
                    "titre": titre,
                    "type_code": proc.get("code"),
                    "type": proc.get("libelle"),
                    "date": max_date(dp.get("actesLegislatifs")),
                }
            )

    lois.sort(key=lambda x: x["date"] or "", reverse=True)
    recent = lois[:KEEP]

    out = {
        "source": "Assemblée nationale (open data)",
        "source_url": "https://data.assemblee-nationale.fr",
        "legislature": 17,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_total": len(lois),
        "n_kept": len(recent),
        "lois": recent,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    last = recent[0]["date"] if recent else "—"
    print(f"  ✓ {len(lois)} dossiers → {len(recent)} récents (≤ {last}) — {size_kb:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
