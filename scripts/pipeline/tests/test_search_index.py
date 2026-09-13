import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("search_index", Path(__file__).parents[1] / "build-search-index.py")
index = importlib.util.module_from_spec(spec)
spec.loader.exec_module(index)

class SearchIndexContract(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        index.ROOT = Path(self.directory.name)
        index.RAW = index.ROOT / "geo"
        index.RAW.mkdir()
        index.OUT = index.ROOT / "search-index.json"
        index.OUT.write_text("previous version")
        for name, properties in {
            "regions": [{"code": "01", "nom": "Guadeloupe"}],
            "departements": [{"code": "971", "nom": "Guadeloupe"}],
            "circonscriptions": [{"codeCirconscription": "97101", "nomCirconscription": "Première"}],
            "communes": [{"code": "97105", "nom": "Basse-Terre"}, {"code": "2A004", "nom": "Ajaccio"}, {"code": "01001", "nom": "L’Abergement"}],
        }.items(): self.write(name, properties)

    def write(self, name, properties):
        (index.RAW / f"{name}.geojson").write_text(json.dumps({"type":"FeatureCollection", "features":[{"type":"Feature", "properties": p} for p in properties]}))

    def test_codes_accents_and_deterministic_output(self):
        self.assertEqual(index.main(), 0)
        contents = index.OUT.read_bytes()
        communes = {entry["code"]: entry for entry in json.loads(contents) if entry["type"] == "commune"}
        self.assertEqual(communes["97105"]["codeDepartement"], "971")
        self.assertEqual(communes["2A004"]["codeDepartement"], "2A")
        self.assertEqual(communes["01001"]["nom"], "L’Abergement")
        index.main()
        self.assertEqual(index.OUT.read_bytes(), contents)

    def test_missing_source_preserves_previous_output(self):
        (index.RAW / "communes.geojson").unlink()
        with self.assertRaises(ValueError): index.main()
        self.assertEqual(index.OUT.read_text(), "previous version")

    def test_invalid_collections_preserve_previous_output(self):
        for payload in [[], {}, {"type":"FeatureCollection", "features":[]}, {"type":"FeatureCollection", "features":[{}]}]:
            with self.subTest(payload=payload):
                (index.RAW / "communes.geojson").write_text(json.dumps(payload))
                with self.assertRaises(ValueError): index.main()
                self.assertEqual(index.OUT.read_text(), "previous version")

    def test_missing_numeric_or_duplicate_code_is_rejected(self):
        for properties in [[{"nom":"Sans code"}], [{"code":1001,"nom":"Numérique"}], [{"code":"01001","nom":"A"}]*2]:
            with self.subTest(properties=properties):
                self.write("communes", properties)
                with self.assertRaises(ValueError): index.main()
                self.assertEqual(index.OUT.read_text(), "previous version")

if __name__ == "__main__": unittest.main()
