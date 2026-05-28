#!/usr/bin/env python3
"""
Votes solennels & scrutins publics de l'Assemblée nationale (17e législature).

- source : data.assemblee-nationale.fr (open data officiel)
            Scrutins.json.zip → 1 JSON par scrutin
- output : public/suivi/votes-an.json (les N scrutins les plus récents)

On garde l'essentiel : n°, date, titre, sort, type, décompte pour/contre/abst,
demandeur. Limité aux plus récents pour garder le fichier léger.
"""
from __future__ import annotations

import io
import json
import sys
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "suivi" / "votes-an.json"
SRC_URL = "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip"
KEEP = 250  # nombre de scrutins récents conservés


def to_int(x) -> int:
    try:
        return int(x)
    except (TypeError, ValueError):
        return 0


def main() -> int:
    print("→ Téléchargement scrutins AN (17e législature)")
    try:
        req = urllib.request.Request(SRC_URL, headers={"User-Agent": "MOUVANCIA pipeline"})
        with urllib.request.urlopen(req, timeout=120) as r:
            blob = r.read()
    except Exception as e:  # noqa: BLE001
        print(f"✗ téléchargement échoué : {e}", file=sys.stderr)
        return 1

    votes = []
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        names = [n for n in z.namelist() if n.endswith(".json")]
        for name in names:
            try:
                s = json.loads(z.read(name)).get("scrutin", {})
            except Exception:  # noqa: BLE001
                continue
            synth = s.get("syntheseVote", {}) or {}
            dec = synth.get("decompte", {}) or {}
            sort = s.get("sort", {}) or {}
            type_vote = s.get("typeVote", {}) or {}
            demandeur = s.get("demandeur", {}) or {}
            votes.append(
                {
                    "numero": s.get("numero"),
                    "date": s.get("dateScrutin"),
                    "titre": s.get("titre"),
                    "sort": sort.get("code"),
                    "sort_libelle": sort.get("libelle"),
                    "type": type_vote.get("libelleTypeVote"),
                    "demandeur": demandeur.get("texte"),
                    "votants": to_int(synth.get("nombreVotants")),
                    "exprimes": to_int(synth.get("suffragesExprimes")),
                    "pour": to_int(dec.get("pour")),
                    "contre": to_int(dec.get("contre")),
                    "abstentions": to_int(dec.get("abstentions")),
                }
            )

    # Tri par date puis n° décroissants → plus récents en premier.
    votes.sort(key=lambda v: (v["date"] or "", to_int(v["numero"])), reverse=True)
    recent = votes[:KEEP]

    out = {
        "source": "Assemblée nationale (open data)",
        "source_url": "https://data.assemblee-nationale.fr",
        "legislature": 17,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_total": len(votes),
        "n_kept": len(recent),
        "votes": recent,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    last = recent[0]["date"] if recent else "—"
    print(f"  ✓ {len(votes)} scrutins → {len(recent)} récents (≤ {last}) — {size_kb:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
