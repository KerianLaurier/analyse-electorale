#!/usr/bin/env python3
"""
Référentiel des députés en exercice (17e législature) — open data AN.

Source : data.assemblee-nationale.fr, dataset AMO40 « députés actifs / mandats
actifs / organes » (acteurs + organes). Officiel, mis à jour en continu.

Pour chaque député actif on extrait :
  - identité civile (civilité, prénom, nom, sexe)
  - circonscription d'élection (code dept(2) + circo(2), aligné sur nos données)
  - groupe parlementaire COURANT (mandat GP sans dateFin) : sigle, libellé,
    couleur officielle AN, position politique
  - date de début du mandat à l'Assemblée

Sortie : public/an/deputes.json
  {
    "source": ..., "legislature": 17, "generated_at": ..., "n": 577,
    "deputes": [ { circo, uid, civ, prenom, nom, sexe, groupe, groupeLib,
                   groupeColor, position, depuis } ]
  }
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
OUT = ROOT / "public" / "an" / "deputes.json"
SRC_URL = (
    "https://data.assemblee-nationale.fr/static/openData/repository/17/amo/"
    "deputes_actifs_mandats_actifs_organes_divises/"
    "AMO40_deputes_actifs_mandats_actifs_organes_divises.json.zip"
)
LEGISLATURE = 17


def as_list(x):
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def circo_code(lieu: dict) -> str | None:
    """election.lieu → code circo « dept(2) + circo(2) » (ex. 62-5 → 6205)."""
    dep = (lieu or {}).get("numDepartement")
    circ = (lieu or {}).get("numCirco")
    if not dep or not circ:
        return None
    dep = dep.strip()
    # Métropole : zéro-padding à 2 ; outre-mer (971…) gardé tel quel.
    dep2 = dep.zfill(2) if dep.isdigit() and len(dep) <= 2 else dep
    return f"{dep2}{str(circ).strip().zfill(2)}"


def main() -> int:
    print("→ Téléchargement AMO40 députés actifs (AN, 17e législature)")
    try:
        req = urllib.request.Request(SRC_URL, headers={"User-Agent": "MOUVANCIA pipeline"})
        with urllib.request.urlopen(req, timeout=120) as r:
            blob = r.read()
    except Exception as e:  # noqa: BLE001
        print(f"✗ téléchargement échoué : {e}", file=sys.stderr)
        return 1

    z = zipfile.ZipFile(io.BytesIO(blob))
    names = z.namelist()

    # Organes (groupes parlementaires) : ref → {sigle, libellé, couleur, position}
    organes: dict[str, dict] = {}
    for n in names:
        if not n.startswith("organe/"):
            continue
        o = json.loads(z.read(n)).get("organe", {})
        if o.get("codeType") != "GP":
            continue
        uid = (o.get("uid") or {})
        ref = uid.get("#text") if isinstance(uid, dict) else uid
        if not ref:
            continue
        organes[ref] = {
            "sigle": o.get("libelleAbrege") or o.get("libelleAbrev"),
            "libelle": o.get("libelle"),
            "couleur": o.get("couleurAssociee"),
            "position": o.get("positionPolitique"),
        }

    deputes = []
    for n in names:
        if not n.startswith("acteur/"):
            continue
        a = json.loads(z.read(n)).get("acteur", {})
        ident = (a.get("etatCivil") or {}).get("ident") or {}
        uid = (a.get("uid") or {})
        pa = uid.get("#text") if isinstance(uid, dict) else uid

        circo = None
        depuis = None
        groupe_ref = None
        for m in as_list((a.get("mandats") or {}).get("mandat")):
            t = m.get("typeOrgane")
            if t == "ASSEMBLEE" and str(m.get("legislature")) == str(LEGISLATURE):
                circo = circo_code((m.get("election") or {}).get("lieu") or {})
                depuis = m.get("dateDebut")
            elif t == "GP" and m.get("dateFin") in (None, "") and str(m.get("legislature")) == str(LEGISLATURE):
                groupe_ref = (m.get("organes") or {}).get("organeRef")

        if not circo:
            continue
        g = organes.get(groupe_ref or "", {})
        civ = ident.get("civ")
        deputes.append({
            "circo": circo,
            "uid": pa,
            "civ": civ,
            "prenom": ident.get("prenom"),
            "nom": ident.get("nom"),
            "sexe": "F" if civ == "Mme" else "M" if civ == "M." else None,
            "groupe": g.get("sigle"),
            "groupeLib": g.get("libelle"),
            "groupeColor": g.get("couleur"),
            "position": g.get("position"),
            "depuis": depuis,
        })

    deputes.sort(key=lambda d: d["circo"])
    payload = {
        "source": "Assemblée nationale (open data) — AMO40 députés actifs",
        "source_url": "https://data.assemblee-nationale.fr",
        "license": "Licence Ouverte 2.0",
        "legislature": LEGISLATURE,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "n": len(deputes),
        "deputes": deputes,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    size_kb = OUT.stat().st_size / 1024
    n_grp = sum(1 for d in deputes if d["groupe"])
    print(f"✓ {len(deputes)} députés ({n_grp} avec groupe) → {OUT.relative_to(ROOT)} ({size_kb:.0f} Ko)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
