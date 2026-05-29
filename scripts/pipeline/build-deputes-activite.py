#!/usr/bin/env python3
"""
Activité parlementaire par député — votes solennels & motions de censure (AN).

Source : data.assemblee-nationale.fr, Scrutins.json.zip (17e législature),
ventilation nominative des votes (1 entrée par député et par scrutin).

On ne retient que les scrutins à fort enjeu — « scrutin public solennel » et
« motion de censure » — où la présence est attendue (les ~7 000 scrutins
ordinaires ont une présence faible et peu signifiante).

Pour chaque député (acteurRef PA…) on calcule :
  - v : chaîne de positions alignée sur `scrutins`, 1 caractère / scrutin
        P=pour, C=contre, A=abstention, N=non-votant (présent, refus), .=absent
  - p : taux de participation (P/C/A sur le total des scrutins retenus)
  - l : loyauté au groupe (part des votes alignés sur la position majoritaire
        de son groupe, sur les votes exprimés où le groupe a une consigne)

Sortie : public/an/deputes-activite.json
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
OUT = ROOT / "public" / "an" / "deputes-activite.json"
SRC_URL = "https://data.assemblee-nationale.fr/static/openData/repository/17/loi/scrutins/Scrutins.json.zip"
KEEP_TYPES = {"scrutin public solennel", "motion de censure"}

POS_CHAR = {"pours": "P", "contres": "C", "abstentions": "A", "nonVotants": "N"}
MAJ_CHAR = {"pour": "P", "contre": "C", "abstention": "A", "abstentions": "A"}


def as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def to_int(x) -> int:
    try:
        return int(x)
    except (TypeError, ValueError):
        return 0


def main() -> int:
    print("→ Téléchargement scrutins AN (activité nominative)")
    try:
        req = urllib.request.Request(SRC_URL, headers={"User-Agent": "MOUVANCIA pipeline"})
        with urllib.request.urlopen(req, timeout=180) as r:
            blob = r.read()
    except Exception as e:  # noqa: BLE001
        print(f"✗ téléchargement échoué : {e}", file=sys.stderr)
        return 1

    z = zipfile.ZipFile(io.BytesIO(blob))
    scrutins = []
    for name in z.namelist():
        if not name.endswith(".json"):
            continue
        try:
            s = json.loads(z.read(name)).get("scrutin", {})
        except Exception:  # noqa: BLE001
            continue
        tv = (s.get("typeVote") or {})
        type_lib = tv.get("libelleTypeVote")
        if type_lib not in KEEP_TYPES:
            continue
        scrutins.append(s)

    # Plus récents d'abord.
    scrutins.sort(key=lambda s: (s.get("dateScrutin") or "", to_int(s.get("numero"))), reverse=True)
    M = len(scrutins)

    meta = []
    # deputes[ref] = {"chars": [...M], "loyal": int, "loyal_den": int}
    deputes: dict[str, dict] = {}

    for idx, s in enumerate(scrutins):
        sort = s.get("sort", {}) or {}
        tv = s.get("typeVote", {}) or {}
        objet = s.get("objet", {}) or {}
        meta.append({
            "numero": s.get("numero"),
            "date": s.get("dateScrutin"),
            "titre": s.get("titre") or objet.get("libelle"),
            "sort": sort.get("code"),
            "type": tv.get("libelleTypeVote"),
        })
        groupes = (((s.get("ventilationVotes") or {}).get("organe") or {})
                   .get("groupes") or {}).get("groupe")
        for g in as_list(groupes):
            vote = g.get("vote", {}) or {}
            maj = MAJ_CHAR.get((vote.get("positionMajoritaire") or "").lower())
            dn = vote.get("decompteNominatif", {}) or {}
            for bucket, char in POS_CHAR.items():
                block = dn.get(bucket)
                if not block:
                    continue
                for votant in as_list(block.get("votant")):
                    ref = votant.get("acteurRef")
                    if not ref:
                        continue
                    d = deputes.setdefault(ref, {"chars": ["."] * M, "loyal": 0, "loyal_den": 0})
                    d["chars"][idx] = char
                    if char in ("P", "C", "A") and maj in ("P", "C", "A"):
                        d["loyal_den"] += 1
                        if char == maj:
                            d["loyal"] += 1

    out_deputes = {}
    for ref, d in deputes.items():
        present = sum(1 for c in d["chars"] if c in ("P", "C", "A"))
        out_deputes[ref] = {
            "v": "".join(d["chars"]),
            "p": round(present / M, 4) if M else 0,
            "l": round(d["loyal"] / d["loyal_den"], 4) if d["loyal_den"] else None,
            "present": present,
        }

    payload = {
        "source": "Assemblée nationale (open data) — Scrutins (votes solennels & motions de censure)",
        "source_url": "https://data.assemblee-nationale.fr",
        "license": "Licence Ouverte 2.0",
        "legislature": 17,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n_scrutins": M,
        "scrutins": meta,
        "deputes": out_deputes,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    print(f"✓ {M} scrutins solennels, {len(out_deputes)} députés → {OUT.relative_to(ROOT)} ({size_kb:.0f} Ko)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
