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

AN_DOSSIER_URL = "https://www.assemblee-nationale.fr/dyn/17/dossiers/{chemin}"


def phase_for(code: str | None) -> str:
    """Catégorise un acte législatif à partir de son codeActe."""
    c = (code or "").upper()
    if "DEPOT" in c:
        return "depot"
    if "PROM" in c:
        return "promulgation"
    if "CC" in c or "SAISINE-CONSEIL" in c:
        return "conseil"
    if "CMP" in c:
        return "cmp"
    if "COM" in c:
        return "commission"
    if "SEANCE" in c or "DEBATS" in c or "DISCUSSION" in c:
        return "seance"
    if "DECISION" in c or "ADOPTION" in c or "REJET" in c:
        return "decision"
    return "autre"


def chamber_for(code: str | None) -> str | None:
    c = (code or "").upper()
    if c.startswith("AN"):
        return "Assemblée nationale"
    if c.startswith("SN"):
        return "Sénat"
    if c.startswith("CMP"):
        return "Commission mixte paritaire"
    if c.startswith("CC"):
        return "Conseil constitutionnel"
    if "PROM" in c:
        return "Gouvernement"
    return None


def walk_actes(node, out: list[dict]) -> None:
    """Collecte les actes (date, code, libellé) récursivement."""
    if node is None:
        return
    if isinstance(node, list):
        for x in node:
            walk_actes(x, out)
        return
    if not isinstance(node, dict):
        return
    date = node.get("dateActe")
    lib = node.get("libelleActe")
    code = node.get("codeActe")
    if date:
        libelle = None
        if isinstance(lib, dict):
            libelle = lib.get("nomCanonique") or lib.get("libelleCourt")
        out.append({"date": date[:10], "code": code, "libelle": libelle or ""})
    child = node.get("actesLegislatifs")
    if isinstance(child, dict):
        walk_actes(child.get("acteLegislatif"), out)
    elif isinstance(child, list):
        walk_actes(child, out)
    if "acteLegislatif" in node:
        walk_actes(node.get("acteLegislatif"), out)


def analyse_actes(actes) -> dict:
    raw: list[dict] = []
    walk_actes(actes, raw)
    if not raw:
        return {"date": None, "date_depot": None, "stade": None, "n_actes": 0, "timeline": []}
    raw.sort(key=lambda x: x["date"])

    # Frise : dédoublonnage (date+libellé), enrichie phase/chambre.
    seen = set()
    steps = []
    for a in raw:
        key = (a["date"], a["libelle"])
        if key in seen:
            continue
        seen.add(key)
        steps.append(
            {
                "date": a["date"],
                "libelle": a["libelle"],
                "phase": phase_for(a["code"]),
                "chambre": chamber_for(a["code"]),
            }
        )

    # Condense les étapes consécutives identiques (même libellé + chambre) en un
    # jalon unique avec plage de dates + nombre de séances.
    timeline = []
    for s in steps:
        last = timeline[-1] if timeline else None
        if last and last["libelle"] == s["libelle"] and last["chambre"] == s["chambre"]:
            last["date_fin"] = s["date"]
            last["count"] += 1
        else:
            timeline.append({**s, "date_fin": s["date"], "count": 1})

    return {
        "date": raw[-1]["date"],
        "date_depot": raw[0]["date"],
        "stade": raw[-1]["libelle"] or None,
        "n_actes": len(raw),
        "timeline": timeline,
    }


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
            titre_dossier = dp.get("titreDossier") or {}
            titre = titre_dossier.get("titre")
            if not titre:
                continue
            proc = dp.get("procedureParlementaire") or {}
            chemin = titre_dossier.get("titreChemin")
            info = analyse_actes(dp.get("actesLegislatifs"))
            lois.append(
                {
                    "uid": dp.get("uid"),
                    "titre": titre,
                    "type_code": proc.get("code"),
                    "type": proc.get("libelle"),
                    "date": info["date"],
                    "date_depot": info["date_depot"],
                    "stade": info["stade"],
                    "n_actes": info["n_actes"],
                    "timeline": info["timeline"],
                    "url": AN_DOSSIER_URL.format(chemin=chemin) if chemin else None,
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
