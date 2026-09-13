# Pipeline de données — Analyse Electorale

Le pipeline produit des fichiers Parquet intermédiaires, puis des JSON précalculés pour l’analyse et des PMTiles pour la carte. Le client courant charge ces JSON et MapLibre ; il n’exécute plus les requêtes analytiques dans DuckDB-WASM. Les données de travail privées de l’application sont stockées séparément dans Supabase.

## Environnement reproductible

Utiliser Python 3.13 dans un environnement virtuel :

```bash
python3.13 -m venv .venv
source .venv/bin/activate
python -m pip install --require-hashes -r scripts/pipeline/requirements.txt
python -m unittest discover -s scripts/pipeline/tests -v
bash scripts/pipeline/all.sh
```

`requirements.in` décrit les dépendances directes ; `requirements.txt` fixe aussi les dépendances transitives et leurs empreintes. Les workflows utilisent ce fichier. Pour une mise à jour intentionnelle, utiliser `pip-tools==7.6.1` avec Python 3.13 puis `pip-compile --strip-extras --no-emit-index-url --no-emit-trusted-host --output-file=scripts/pipeline/requirements.txt scripts/pipeline/requirements.in` et `python scripts/pipeline/add-lock-hashes.py`. Vérifier les changements et relancer les tests avant publication ([documentation pip-tools](https://pip-tools.readthedocs.io/en/stable/)). Les outils externes de construction de tuiles restent à installer et à versionner séparément.

`download.sh` récupère les sources dans `data/raw/` à partir de `sources.json`. Le téléchargement complet et la génération de toutes les tuiles restent nécessaires pour valider une nouvelle livraison. Les fixtures couvrent la recherche territoriale : codes avec zéro initial, Corse/outre-mer, accents, sources absentes, collections vides et doublons. Ce n’est pas encore une couverture des agrégations de tous les scrutins.

L’index de recherche est remplacé atomiquement uniquement si ses quatre sources sont présentes et valides. Une entrée sans code ou nom, un doublon ou une source absente provoque un échec explicite ; la dernière version reste intacte. Pour publier une version cohérente des données, suivre [la procédure de release](../../docs/data-releases.md).

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

> **Potentiel** : résultat exploratoire d’un modèle ajusté aux données historiques. Le R² publié décrit l’ajustement sur ces données ; ce n’est ni une probabilité, ni une validation prédictive indépendante.

## Scripts (ordre de `all.sh`)

- **Géo / électoral** : `download.sh`, `build-tiles.sh`, `build-parquet.py`,
  `build-aggregates.py`, `build-bureaux.py`, `build-commune-circo.py`.
- **Élus** : `build-personnes.py`, `build-deputes.py`, `build-deputes-activite.py`.
- **Socio** : `build-insee.py` (Filosofi), `build-rp.py` (RP), `build-logement.py`,
  `build-famille.py`, `build-mobilite.py`, `build-circo-socio.py`,
  `build-bureaux-socio.py`.
- **Analytique** : `build-trends.py`, `build-potentiel.py`.
- **Recherche** : `build-search-index.py`.

## Municipales (2020 et 2026) — ce que la donnée permet vraiment

Les deux millésimes sont disponibles de la région au **bureau de vote**. Trois
particularités du scrutin municipal, à connaître avant de lire une carte :

- **Nuance politique réservée aux grandes communes.** Le ministère n'attribue
  de nuance de liste qu'au-dessus d'un seuil de population : ~3 300 communes
  nuancées sur 34 800 en 2026, ~3 200 en 2020. Ailleurs la nuance est vide
  (2026) ou vaut `NC` / `LNC` (2020, ramené à NULL au build). Conséquence : les
  colorations par **bloc** et le **vainqueur** ne couvrent que ces communes ;
  participation et abstention, elles, couvrent tout le territoire. Les listes
  non nuancées restent lisibles à la commune et au bureau, sous leur libellé.
- **Panachage sous 1 000 habitants.** Le scrutin y est plurinominal : un
  électeur coche plusieurs noms, la somme des voix dépasse donc les exprimés.
  Ces communes n'ayant pas de nuance, elles n'entrent dans aucun agrégat par
  bloc — mais un « % des voix » par candidat s'y lit par rapport aux votants,
  pas comme une part de marché.
- **Paris, Lyon, Marseille votent par secteur.** Le fichier ministériel empile
  20 / 9 / 16 scrutins sous un seul code ville, et 2020 y orthographie chaque
  liste différemment selon l'arrondissement. `build-aggregates.py` consolide ces
  trois villes par nuance (libellé de la variante la plus votée) — sans quoi
  Paris affichait 93 listes et sa première ne pesait que 24,9 % au lieu de
  29,3 %. Les autres communes ne sont pas touchées : deux listes de même nuance
  y sont deux offres distinctes.

Les contours de bureaux de vote sont ceux du REU 2022 : **98,9 % des bureaux de
2020** (99,1 % des inscrits) s'y raccordent, le reste ayant été redécoupé depuis.
L'outre-mer 2020 est hors jeu — le ministère y code les départements `ZA`…`ZS`
au lieu des codes INSEE, comme pour les présidentielles 2017/2022.

## Limites connues (open data FR)

- **Pas de fichier électoral individuel** (≠ voter file US) : tout est agrégé
  (bureau / IRIS / commune).
- **Élus municipaux non marqués en 2020** : le fichier par bureau de vote ne
  porte pas de colonne « Élu » (contrairement à 2026) — le badge d'élu reste
  donc vide sur ce millésime.
- **Immigration / nationalité** : absente des bases « chiffres clés » communales
  INSEE (réservée au fichier détail individuel, non intégré). Substituée par la
  mobilité résidentielle.
- **IRIS** : la donnée famille est déjà à l'IRIS ; les autres couches restent
  communales. Un passage infra-communal (contours IRIS en pmtiles + maille
  dédiée) est le prochain saut de granularité, non encore réalisé.

## Performance

Les tailles et la couverture des tableaux ci-dessus sont des observations historiques, pas des budgets garantis. Mesurer les fichiers de chaque nouvelle release et les parcours mobiles avant activation. Les PMTiles utilisent des requêtes HTTP Range ; les JSON sont chargés à la demande et conservés dans des caches bornés.
