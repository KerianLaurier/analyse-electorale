# Pipeline de données — Analyse Electorale

Toutes les données sont **open data**, pré-calculées au build en **Parquet/PMTiles
statiques** servis depuis `public/`, et interrogées côté client par **DuckDB-WASM**
(lecture HTTP range) + **MapLibre/pmtiles**. Aucun backend, aucune donnée
individuelle (agrégats commune / bureau / IRIS uniquement — RGPD).

## Rafraîchir

```bash
bash scripts/pipeline/all.sh        # download → tuiles → tous les parquets
```

`download.sh` récupère les sources brutes dans `data/raw/` (gitignoré) à partir
des URL de `sources.json`. Le socle électoral + socio est *build-once* :
relancer `all.sh` à chaque nouveau millésime INSEE / scrutin.

## Couche socio-démographique (commune)

| Fichier `public/insee/` | Source open data | Indicateurs | Poids | Couverture |
|---|---|---|---|---|
| `filosofi_2021_commune.parquet` | Filosofi 2021 (INSEE) | revenu médian, taux de pauvreté, déciles D1/D9, prestations, pensions | 216 Ko | partielle (NULL sur petites communes — secret statistique) |
| `rp_2022_commune.parquet` | RP 2022 (INSEE melodi) | population, 65 ans +, < 15 ans, chômage, cadres, ouvriers, diplômés sup | 420 Ko | ~complète |
| `logement_2022_commune.parquet` | Comparateur de territoires (INSEE) | propriétaires, locataires, résidences secondaires, logements vacants | 202 Ko | 34 893 communes |
| `famille_2022_commune.parquet` | Couples-Familles-Ménages 2022 (IRIS → agrégé commune) | familles monoparentales, personnes seules | 111 Ko | 34 949 communes |
| `mobilite_2022_commune.parquet` | Évol-struct-pop 2022 (IRAN) | nouveaux arrivants sur 1 an (renouvellement résidentiel) | 67 Ko | 34 893 communes |
| `circo_socio.parquet` | agrégat des ci-dessus | socio pondérée par population, à la circonscription | 41 Ko | 577 circos |
| `bureaux_socio.parquet` | dérivé (code BV → commune) | socio communale portée sur chaque bureau de vote | 598 Ko | 88 % (hors outre-mer / Français de l'étranger) |

## Couche analytique dérivée (calculée au build)

| Fichier `public/electoral/` | Méthode | Contenu | Poids |
|---|---|---|---|
| `trends/presid_2017_2022.parquet`, `trends/legis_2022_2024.parquet` | deltas sur agrégats électoraux | Δ abstention, Δ bloc RN/ext. droite, Δ bloc gauche/NFP par territoire (région→commune) | 683 + 724 Ko |
| `potentiel_commune.parquet` (+ `potentiel_meta.json`) | régression ridge (présid. 2022) sur 10 variables socio | par bloc (RN, gauche, écolo, centre, droite) : affinité (attendu), réel, potentiel (= attendu − réel). `meta` = R² par bloc | 524 Ko |

> **Potentiel** : indice d'**affinité socio-démographique**, pas un pronostic. Le
> R² (publié dans `potentiel_meta.json`) qualifie chaque bloc : bon pour RN/écolo
> (~0,3), faible pour la droite (~0,06 — le vote LR n'est pas déterminé par le
> socio). Affiché tel quel côté produit (« fiabilité »).

## Scripts (ordre de `all.sh`)

- **Géo / électoral** : `download.sh`, `build-tiles.sh`, `build-parquet.py`,
  `build-aggregates.py`, `build-bureaux.py`, `build-commune-circo.py`.
- **Élus** : `build-personnes.py`, `build-deputes.py`, `build-deputes-activite.py`.
- **Socio** : `build-insee.py` (Filosofi), `build-rp.py` (RP), `build-logement.py`,
  `build-famille.py`, `build-mobilite.py`, `build-circo-socio.py`,
  `build-bureaux-socio.py`.
- **Analytique** : `build-trends.py`, `build-potentiel.py`.
- **Recherche** : `build-search-index.py`.

## Limites connues (open data FR)

- **Pas de fichier électoral individuel** (≠ voter file US) : tout est agrégé
  (bureau / IRIS / commune).
- **Immigration / nationalité** : absente des bases « chiffres clés » communales
  INSEE (réservée au fichier détail individuel, non intégré). Substituée par la
  mobilité résidentielle.
- **IRIS** : la donnée famille est déjà à l'IRIS ; les autres couches restent
  communales. Un passage infra-communal (contours IRIS en pmtiles + maille
  dédiée) est le prochain saut de granularité, non encore réalisé.

## Performance

Mes ajouts socio + analytique pèsent ≈ **2,9 Mo** au total, lazy-loadés par
vue/indicateur (négligeable face aux 33 Mo d'agrégats électoraux et 42 Mo de
tuiles). DuckDB-WASM ne télécharge que les colonnes/lignes utiles (projection +
predicate pushdown sur HTTP range).
