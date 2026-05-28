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

Toutes les pages d'analyse, suivi et fiches existent en squelette (composant `<PagePlaceholder />`) — elles seront remplies au fil des sprints.

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

## Points reportés (à câbler dans les sprints suivants)

- **Supabase** : auth + données propriétaires (équipes, annotations, snapshots). Non installé pour ce sprint.
- **DuckDB-WASM** : installé, Parquets prêts, à instancier dans un worker pour brancher les couches Explorer et le simulateur.
- **Git** : non initialisé (choix utilisateur). À faire avant tout déploiement.
- **Identité visuelle** : palette neutre par défaut shadcn (`neutral`). Charte à définir en phase design.

## Conformité

- RGPD : pas de données personnelles d'électeurs (uniquement agrégats publics).
- Neutralité : codes couleurs partisans alignés sur les conventions du ministère de l'Intérieur, à implémenter dans les couches de la carte.
