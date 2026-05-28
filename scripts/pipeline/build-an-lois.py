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


def walk_actes(node, out: list[tuple[str, str]]) -> None:
    """Collecte (dateActe, libellé de stade) récursivement dans l'arbre d'actes."""
    if node is None:
        return
    if isinstance(node, list):
        for x in node:
            walk_actes(x, out)
        return
    if not isinstance(node, dict):
        return
    # Un acte = a dateActe + libelleActe ; descendre dans actesLegislatifs imbriqués.
    date = node.get("dateActe")
    lib = node.get("libelleActe")
    if date:
        libelle = None
        if isinstance(lib, dict):
            libelle = lib.get("libelleCourt") or lib.get("nomCanonique")
        out.append((date[:10], libelle or ""))
    # Descente récursive (le conteneur peut être {acteLegislatif: ...} ou direct).
    child = node.get("actesLegislatifs")
    if isinstance(child, dict):
        walk_actes(child.get("acteLegislatif"), out)
    elif isinstance(child, list):
        walk_actes(child, out)
    # Cas racine : node lui-même est {acteLegislatif: ...}
    if "acteLegislatif" in node:
        walk_actes(node.get("acteLegislatif"), out)


def analyse_actes(actes) -> dict:
    out: list[tuple[str, str]] = []
    walk_actes(actes, out)
    if not out:
        return {"date": None, "date_depot": None, "stade": None, "n_actes": 0}
    out.sort(key=lambda x: x[0])
    return {
        "date": out[-1][0],           # acte le plus récent
        "date_depot": out[0][0],      # premier acte
        "stade": out[-1][1] or None,  # libellé du stade courant
        "n_actes": len(out),
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
