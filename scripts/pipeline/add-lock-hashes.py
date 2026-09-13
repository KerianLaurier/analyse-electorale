"""Ajoute les empreintes officielles PyPI aux versions résolues par pip-compile.
Ne télécharge pas toutes les roues de toutes les plateformes pour les rehacher.
"""
import json
from pathlib import Path
import re
import urllib.request

path = Path(__file__).with_name("requirements.txt")
text = path.read_text()
if "--hash=" in text:
    raise SystemExit("Régénérez d’abord le fichier sans empreintes avec pip-compile.")
lines = []
for line in text.splitlines():
    match = re.fullmatch(r"([A-Za-z0-9_.-]+)==([A-Za-z0-9_.+-]+)", line)
    if match:
        name, version = match.groups()
        with urllib.request.urlopen(f"https://pypi.org/pypi/{name}/{version}/json", timeout=30) as response:
            metadata = json.load(response)
        hashes = sorted({item["digests"]["sha256"] for item in metadata["urls"] if not item.get("yanked")})
        if not hashes or any(not re.fullmatch(r"[a-f0-9]{64}", value) for value in hashes):
            raise ValueError(f"Empreintes manquantes ou invalides pour {name}")
        lines.append(line + " \\")
        lines.extend("    --hash=sha256:" + value + (" \\" if i < len(hashes)-1 else "") for i, value in enumerate(hashes))
    else:
        lines.append(line)
path.write_text("# Empreintes ajoutées depuis les métadonnées PyPI par add-lock-hashes.py.\n" + "\n".join(lines) + "\n")
