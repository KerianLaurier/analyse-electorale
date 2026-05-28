#!/usr/bin/env python3
"""
Agenda électoral — dates clés des scrutins et échéances de campagne.

Données curées (sources : Code électoral, décrets de convocation, calendrier
constitutionnel). À enrichir plus tard avec un parsing automatique du JORF /
Légifrance pour les décrets de convocation et plafonds de dépenses.

- output : public/suivi/agenda.json
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "suivi" / "agenda.json"

# Catégories : scrutin | echeance | campagne
EVENEMENTS = [
    {
        "date": "2026-09-27",
        "titre": "Élections sénatoriales",
        "type": "scrutin",
        "scrutin": "senatoriales",
        "detail": "Renouvellement de la série concernée du Sénat.",
    },
    {
        "date": "2027-03-01",
        "titre": "Ouverture du recueil des parrainages",
        "type": "echeance",
        "scrutin": "presidentielle",
        "detail": "Le Conseil constitutionnel publie les parrainages plusieurs fois par semaine jusqu'à la clôture.",
    },
    {
        "date": "2027-03-16",
        "titre": "Clôture des parrainages (présidentielle)",
        "type": "echeance",
        "scrutin": "presidentielle",
        "detail": "Date indicative — fixée par décret de convocation. 500 parrainages requis.",
    },
    {
        "date": "2027-04-11",
        "titre": "Présidentielle — 1er tour",
        "type": "scrutin",
        "scrutin": "presidentielle",
        "detail": "Date indicative (11 ou 18 avril 2027 selon décret de convocation).",
    },
    {
        "date": "2027-04-25",
        "titre": "Présidentielle — 2nd tour",
        "type": "scrutin",
        "scrutin": "presidentielle",
        "detail": "Deux semaines après le 1er tour.",
    },
    {
        "date": "2027-06-13",
        "titre": "Législatives — 1er tour",
        "type": "scrutin",
        "scrutin": "legislatives",
        "detail": "Date indicative — classiquement en juin suivant la présidentielle.",
    },
    {
        "date": "2027-06-20",
        "titre": "Législatives — 2nd tour",
        "type": "scrutin",
        "scrutin": "legislatives",
        "detail": "Date indicative.",
    },
]


def main() -> int:
    now = datetime.now(timezone.utc)
    today = now.date().isoformat()
    for e in EVENEMENTS:
        e["passe"] = e["date"] < today
    EVENEMENTS.sort(key=lambda e: e["date"])

    out = {
        "source": "Curé — Code électoral / calendrier constitutionnel",
        "generated_at": now.isoformat(),
        "n": len(EVENEMENTS),
        "evenements": EVENEMENTS,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
    print(f"  ✓ {len(EVENEMENTS)} événements → {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
