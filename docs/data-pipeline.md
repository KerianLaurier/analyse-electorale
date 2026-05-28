# Pipeline de données

Ce document décrit la chaîne de transformation des données ouvertes vers les formats consommés par l'app : **PMTiles** pour la cartographie vectorielle, **Parquet** pour les analytics côté client (DuckDB-WASM).

## Vue d'ensemble

```
data.gouv.fr / Etalab / Grégoire-David
        │
        │ download.sh (curl, idempotent)
        ▼
data/raw/geo/*.geojson        data/raw/electoral/*.{csv,txt}
        │                              │
        │ build-tiles.sh                │ build-parquet.py
        │ (tippecanoe → pmtiles)        │ (DuckDB)
        ▼                              ▼
public/tiles/*.pmtiles         public/electoral/*.parquet
        │                              │
        │ pmtiles:// protocol          │ DuckDB-WASM (côté client)
        ▼                              ▼
        MapLibre <Map />              Analyses (Explorer, simulateur…)
```

## Sources

Toutes les sources sont déclarées dans [scripts/pipeline/sources.json](../scripts/pipeline/sources.json). Pour ajouter ou mettre à jour une source, éditer ce fichier puis re-lancer le pipeline correspondant.

### Géo (contours administratifs)

| Maille | Source | Taille |
| --- | --- | --- |
| Régions | [france-geojson](https://france-geojson.gregoiredavid.fr/) | 478 KB |
| Départements | france-geojson | 1 MB |
| Circonscriptions législatives 2024 | [data.gouv.fr — Contours géographiques](https://www.data.gouv.fr/datasets/contours-geographiques-des-circonscriptions-legislatives/) | 9.7 MB |
| Communes | france-geojson | 22 MB |

> france-geojson (ODbL, Grégoire David) agrège des données OSM et INSEE. Pour passer en production, on pourra basculer vers les SHP IGN ADMIN-EXPRESS-COG (officiels, mise à jour annuelle) via `ogr2ogr`.

### Sondages (notices CNCS)

| Dataset | Source | Sortie |
| --- | --- | --- |
| Notices de sondages | [Commission des sondages](https://www.commission-des-sondages.fr/notices/) (registre public) | `public/sondages/notices.json` |

`build-cncs-notices.py` scrape le registre des notices de la Commission des sondages (seule source **vivante et exhaustive** ; Nsppolls est abandonné depuis 2022). Pour chaque notice : numéro, scrutin (classé via le préfixe : présidentielle / municipales / législatives / européennes / régionales…), institut (canonicalisé), date (année inférée), lien PDF officiel.

> Les chiffres d'intentions sont dans les PDF (formats hétérogènes par institut). Le parsing PDF des résultats sera ajouté progressivement, institut par institut.

**Mise à jour quotidienne** : le workflow [`.github/workflows/sondages.yml`](../.github/workflows/sondages.yml) relance le scraper chaque jour (cron 06:30 UTC) et commit `notices.json` s'il a changé. À activer une fois le repo sur GitHub.

### Électoral

| Dataset | Niveau | Source | Taille brute → Parquet |
| --- | --- | --- | --- |
| Présidentielle 2022 T1 | bureau de vote | MinInt / data.gouv | 36 MB → 4.9 MB |
| Présidentielle 2022 T2 | bureau de vote | MinInt / data.gouv | 13 MB → 2.5 MB |
| Législatives 2024 T1 | bureau de vote | MinInt / data.gouv | 37 MB → 4.9 MB |
| Législatives 2024 T2 | bureau de vote | MinInt / data.gouv | 17 MB → 2.6 MB |
| Législatives 2024 T1 | circonscription | MinInt / data.gouv | 0.3 MB → 0.2 MB |

Tous sous Licence Ouverte 2.0 (Ministère de l'Intérieur).

## Pré-requis

```bash
brew install tippecanoe pmtiles gdal
pip3 install --user duckdb
```

- `tippecanoe` : tuilage vectoriel (Mapbox). Génère des `.mbtiles`.
- `pmtiles` : conversion `.mbtiles` → `.pmtiles` (single-file, HTTP-range-request-friendly).
- `gdal` : `ogr2ogr` pour reprojeter / convertir d'éventuels SHP (réservé aux ajouts futurs).
- `duckdb` (Python) : ingestion CSV/TXT → Parquet ZSTD.

## Exécution

### Tout d'un coup

```bash
bash scripts/pipeline/all.sh
```

### Étape par étape

```bash
bash scripts/pipeline/download.sh         # télécharge tout dans data/raw/
bash scripts/pipeline/build-tiles.sh      # → public/tiles/*.pmtiles
python3 scripts/pipeline/build-parquet.py # → public/electoral/*.parquet
```

Re-lancer une étape est idempotent : `download.sh` saute les fichiers déjà téléchargés (utiliser `--force` pour ré-télécharger), `build-tiles.sh` et `build-parquet.py` écrasent leur sortie.

## Format des fichiers MinInt

Les fichiers `presidentielle_2022_*.txt` du Ministère de l'Intérieur sont des CSV semi-colon, encodage **latin-1**, avec une particularité : chaque ligne contient les colonnes du bureau de vote **suivies des résultats de chaque candidat appendus en bout de ligne**. La largeur varie donc avec le nombre de candidats au scrutin.

L'ingestion DuckDB utilise `null_padding=true` pour aligner toutes les lignes sur la plus large, et `all_varchar=true` pour éviter les surprises de typage. La **normalisation long-format** (1 ligne par bureau × candidat) est laissée à DuckDB-WASM au moment de la requête analytique côté client — column pruning + predicate pushdown rendent l'opération performante même sur 70k bureaux.

Les fichiers `legislatives_2024_*.csv` sont en UTF-8 et plus standards.

## Tuiles vectorielles (PMTiles)

Configuration courante dans [scripts/pipeline/build-tiles.sh](../scripts/pipeline/build-tiles.sh) :

| Maille | minzoom | maxzoom |
| --- | --- | --- |
| Régions | 0 | 8 |
| Départements | 0 | 9 |
| Circonscriptions | 0 | 11 |
| Communes | 6 | 13 |

Options tippecanoe activées pour préserver la précision :
- `--no-feature-limit` et `--no-tile-size-limit` : pas de drop automatique
- `--simplification=1` + `--no-line-simplification` : précision géométrique maximale
- `--no-tile-compression` : laisse MapLibre / le serveur HTTP gérer la compression
- `--read-parallel` : utilise tous les cœurs CPU

Les `.pmtiles` sont servis depuis `public/tiles/` directement par Next.js en HTTP avec support des range requests. MapLibre est configuré pour parler le protocole `pmtiles://` via le package [pmtiles](https://github.com/protomaps/PMTiles).

> En production on basculera ce dossier vers un object store (Cloudflare R2 ou S3) pour éviter de gonfler le build et bénéficier d'un CDN dédié — la `<Map />` ne change pas, juste l'origine.

## Re-générer après une mise à jour de données

1. Mettre à jour les URLs dans `scripts/pipeline/sources.json` si une nouvelle version est publiée.
2. `bash scripts/pipeline/download.sh --force`
3. `bash scripts/pipeline/build-tiles.sh && python3 scripts/pipeline/build-parquet.py`
4. Commit les `.pmtiles` (tant qu'on les sert depuis `public/`).

## À venir

- [ ] Pipeline législatives 2022, présidentielles 2002–2017 par bureau (RNE).
- [ ] Recensement INSEE (revenu médian, CSP, âge médian) par commune en Parquet partitionné.
- [ ] Bascule de `public/tiles/` vers R2 + variable d'env `NEXT_PUBLIC_TILES_BASE_URL`.
- [ ] Génération automatique d'un manifeste `data/manifest.json` listant les datasets et leur date de mise à jour, lu côté client.
