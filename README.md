# Analyse électorale

Outil professionnel d'analyse politique et électorale — cible : présidentielle d'avril 2027 et législatives consécutives. Produit destiné aux militants, candidats, équipes de campagne et partis politiques.

Voir le brief complet (sections 1–10) pour le contexte et la roadmap.

## Stack

- **Next.js 16** (App Router, RSC, TypeScript)
- **Tailwind CSS v4** + **shadcn/ui** (base `neutral`, components dans `src/components/ui`)
- **TanStack Query** pour le cache des requêtes serveur
- **MapLibre GL JS** + **pmtiles** pour la cartographie (PMTiles à brancher dans le sprint données)
- **DuckDB-WASM** pour les requêtes analytiques côté client (Parquet électoraux)
- **next-themes** pour light/dark
- **cmdk** (via shadcn) pour la palette de commandes `⌘K`

> Note : Next.js 16 installé (le brief mentionne v15) ; même API App Router, aucun ajustement nécessaire.

## Lancer en local

```bash
npm install
npm run dev
```

L'app démarre sur http://localhost:3000.

Scripts :

| Script | Rôle |
| --- | --- |
| `npm run dev` | dev server (HMR) |
| `npm run build` | build de production |
| `npm start` | lance le build de production |
| `npm run lint` | ESLint |

## Structure des routes

Implémentée à l'identique de la section 5 du brief :

```
/                           Landing publique
/explorer                   Vue principale (carte)
/explorer/[maille]/[code]   État d'URL avec sélection
/analyser                   → redirige vers /analyser/simulateur
  /comparateur
  /simulateur
  /marginalite
/suivre                     → redirige vers /suivre/sondages
  /sondages
  /parrainages
  /agenda
  /soiree
/circo/[code]
/commune/[insee]
/candidat/[id]
/elu/[id]
/auth
  /login
  /signup
  /team
```

Les fiches territoire `/circo/[code]` et `/commune/[insee]` et les fiches personne `/candidat/[id]` et `/elu/[id]` sont implémentées (historique multi-scrutins, sociologie INSEE, classement, enrichissement nominatif). Les sous-pages `Suivre` restantes (`/parrainages`, `/soiree`) existent encore en squelette (`<PagePlaceholder />`).

> Fiches personne — l'`id` est déterministe : `/candidat/{scrutin}__{circo}__{slug-nom}` et `/elu/{circo}` (ou `/elu/{scrutin}__{circo}`). Le prénom et le sexe proviennent des PV par bureau de vote (législatives 2024), précalculés dans `public/electoral/personnes-2024.json` via `scripts/pipeline/build-personnes.py`.

> Députés en exercice — `scripts/pipeline/build-deputes.py` télécharge le dataset officiel AMO40 de l'Assemblée nationale (17ᵉ législature) et produit `public/an/deputes.json` (identité, circonscription, **groupe parlementaire courant** avec sa couleur officielle). Ces 577 députés sont **recherchables dans ⌘K** (→ `/elu/{circo}`) et enrichissent la fiche élu (groupe + date de mandat).

> Activité parlementaire — `scripts/pipeline/build-deputes-activite.py` extrait des scrutins AN les **votes nominatifs** sur les votes publics solennels et motions de censure (17ᵉ législature) → `public/an/deputes-activite.json`. La fiche élu affiche la **participation**, la **loyauté au groupe** (alignement sur la position majoritaire) et le détail des votes (Pour / Contre / Abstention / Absent) par scrutin.

## Architecture du code

```
src/
  app/                      App Router (pages + layout global)
    explorer/               Vue Explorer (carte 3 colonnes)
  components/
    app-header.tsx          Header global + bouton recherche (déclenche ⌘K)
    command-palette.tsx     CommandDialog + raccourcis ⌘K et F (focus mode)
    map.tsx                 Wrapper MapLibre minimal (style OSM en attendant PMTiles)
    page-placeholder.tsx    Squelette des pages non encore implémentées
    ui/                     Composants shadcn (button, dialog, command, …)
  providers/
    query-provider.tsx      QueryClientProvider TanStack Query
    theme-provider.tsx      next-themes (light/dark/system)
  lib/
    utils.ts                cn() et helpers
```

## Raccourcis

- `⌘K` / `Ctrl+K` : ouvre la palette de commandes (navigation + actions)
- `F` (en dehors d'un input) : bascule le mode focus (à câbler avec une classe `.focus-mode` masquant le chrome — utile pour soirée élec et présentations)

## Pipeline de données

Documenté dans [`docs/data-pipeline.md`](docs/data-pipeline.md). En résumé :

```bash
brew install tippecanoe pmtiles gdal
pip3 install --user duckdb
bash scripts/pipeline/all.sh   # download + tiles + parquet
```

Produit :
- `public/tiles/{regions,departements,circonscriptions,communes}.pmtiles` — servis directement par Next.
- `public/electoral/*.parquet` — chargés à la demande par DuckDB-WASM via HTTP range.

> **Maille bureau de vote** — la 5ᵉ maille s'appuie sur le découpage officiel le plus récent et précis : les *contours des bureaux de vote* d'Etalab (reconstruits depuis le Répertoire Électoral Unique INSEE + BAN, Licence Ouverte 2.0). Les **PMTiles sont servis directement par data.gouv.fr** (pas de copie locale de 282 Mo) ; voir `TILES.bureaux` dans `src/lib/map-config.ts` et l'entrée `geo.bureaux` de `scripts/pipeline/sources.json`. Les résultats par bureau sont agrégés depuis les fichiers MinInt par `scripts/pipeline/build-bureaux.py` → `public/electoral/agg/{scrutin}_bureaux_*.parquet`, avec la clé de jointure `codeBureauVote` (`01001_0001`). Disponible pour **présidentielles 2017 & 2022 (T1/T2)** et **législatives 2022 & 2024 (T1/T2)**. Contours adossés au REU 2022 : couverture quasi-complète, quelques bureaux re-numérotés depuis peuvent manquer.

> **Sociologie (INSEE Filosofi 2021)** — `build-insee.py` expose 9 indicateurs par commune : revenu médian, taux de pauvreté, 1er/9e déciles, rapport interdécile (inégalités), parts pensions/retraites, prestations sociales, indemnités chômage et ménages imposés.

> **Démographie (INSEE Recensement 2022)** — `build-rp.py` agrège 3 datasets melodi SDMX (population/âge, emploi/chômage, diplômes) → `public/insee/rp_2022_commune.parquet` : population, part des 65 ans + / moins de 15 ans, taux de chômage, parts de cadres / ouvriers, diplômés du supérieur. Surfacés dans la fiche commune (sections « Sociologie » + « Démographie ») et en **9 colorations Explorer** sur la maille commune (revenu, pauvreté, inégalités, prestations, pensions, 65 ans +, chômage, cadres, diplômés du supérieur).

> **Perf carto** — les feature-states de la choroplèthe (jusqu'à ~70 k bureaux) sont appliqués **par lots de 5 000 via `requestAnimationFrame`** avec annulation si la maille/coloration change, pour garder le thread principal réactif (`src/components/map.tsx`).

## Points reportés (à câbler dans les sprints suivants)

- **Supabase** : auth + données propriétaires (équipes, annotations, snapshots). Non installé pour ce sprint.
- **DuckDB-WASM** : installé, Parquets prêts, à instancier dans un worker pour brancher les couches Explorer et le simulateur.
- **Git** : non initialisé (choix utilisateur). À faire avant tout déploiement.
- **Identité visuelle** : palette neutre par défaut shadcn (`neutral`). Charte à définir en phase design.

## Conformité

- RGPD : pas de données personnelles d'électeurs (uniquement agrégats publics).
- Neutralité : codes couleurs partisans alignés sur les conventions du ministère de l'Intérieur, à implémenter dans les couches de la carte.
