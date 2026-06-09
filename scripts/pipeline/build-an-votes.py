#!/usr/bin/env python3
"""
Votes solennels & scrutins publics de l'Assemblée nationale (17e législature).

- source : data.assemblee-nationale.fr (open data officiel)
            Scrutins.json.zip → 1 JSON par scrutin
            AMO40 (organes) → mapping organeRef → sigle de groupe
- output : public/suivi/votes-an.json (les N scrutins les plus récents)

On garde l'essentiel : n°, date, titre, sort, type, décompte pour/contre/abst,
demandeur, et la ventilation PAR GROUPE (position majoritaire + décompte) —
elle permet côté app de filtrer les scrutins selon la position du groupe du
député de l'utilisateur. Limité aux plus récents pour garder le fichier léger.
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
AMO_URL = (
    "https://data.assemblee-nationale.fr/static/openData/repository/17/amo/"
    "deputes_actifs_mandats_actifs_organes_divises/"
    "AMO40_deputes_actifs_mandats_actifs_organes_divises.json.zip"
)
KEEP = 250  # nombre de scrutins récents conservés


def to_int(x) -> int:
    try:
        return int(x)
    except (TypeError, ValueError):
        return 0


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "MOUVANCIA pipeline"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def load_groupe_sigles() -> dict[str, str]:
    """organeRef → sigle des groupes parlementaires (AMO40, comme build-deputes)."""
    blob = fetch(AMO_URL)
    sigles: dict[str, str] = {}
    with zipfile.ZipFile(io.BytesIO(blob)) as z:
        for n in z.namelist():
            if not n.startswith("organe/"):
                continue
            o = json.loads(z.read(n)).get("organe", {})
            if o.get("codeType") != "GP":
                continue
            uid = o.get("uid") or {}
            ref = uid.get("#text") if isinstance(uid, dict) else uid
            sigle = o.get("libelleAbrege") or o.get("libelleAbrev")
            if ref and sigle:
                sigles[ref] = sigle
    return sigles


def as_list(x) -> list:
    """L'open data AN sérialise 1 élément comme objet, plusieurs comme liste."""
    if x is None:
        return []
    return x if isinstance(x, list) else [x]


def extract_groupes(scrutin: dict, sigles: dict[str, str]) -> list[dict]:
    """Ventilation par groupe : sigle, position majoritaire, décompte."""
    ventilation = (
        ((scrutin.get("ventilationVotes") or {}).get("organe") or {}).get("groupes") or {}
    )
    out = []
    for g in as_list(ventilation.get("groupe")):
        ref = g.get("organeRef")
        vote = g.get("vote") or {}
        dec = vote.get("decompteVoix") or {}
        sigle = sigles.get(ref or "")
        if not sigle:
            continue
        out.append(
            {
                "sigle": sigle,
                "position": vote.get("positionMajoritaire"),
                "pour": to_int(dec.get("pour")),
                "contre": to_int(dec.get("contre")),
                "abstentions": to_int(dec.get("abstentions")),
            }
        )
    return out


def main() -> int:
    print("→ Téléchargement organes AN (sigles de groupes)")
    try:
        sigles = load_groupe_sigles()
        print(f"  {len(sigles)} groupes parlementaires")
    except Exception as e:  # noqa: BLE001
        # Dégradation : sans sigles, on publie les scrutins sans ventilation.
        print(f"  ! organes indisponibles ({e}) — ventilation par groupe omise", file=sys.stderr)
        sigles = {}

    print("→ Téléchargement scrutins AN (17e législature)")
    try:
        blob = fetch(SRC_URL)
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
                    "groupes": extract_groupes(s, sigles),
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
