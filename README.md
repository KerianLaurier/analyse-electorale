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
| `npm run check:lock` | vérifie que `package-lock.json` est installable sur les runners (linux/x64) |

### Hooks git (à activer une fois par clone)

```bash
git config core.hooksPath .githooks
```

Le hook `pre-commit` lance `npm run check:lock` quand `package-lock.json` fait
partie du commit. Il évite un piège coûteux : un `npm install` lancé depuis
macOS élague du lock les dépendances des variantes `wasm32-wasi` (`@emnapi/*`).
Le lock reste alors valide en local mais casse `npm ci` sur GitHub Actions —
c'est ce qui a mis CI et le refresh quotidien en échec pendant 3 jours.

Si le lock doit être régénéré :

```bash
rm -rf node_modules package-lock.json && npm install --os=linux --cpu=x64 && npm install
```

## Structure des routes

**Deux groupes de routes, deux layouts racines** — `src/app/(vitrine)/` et
`src/app/(app)/`. Les parenthèses n'apparaissent pas dans les URL : `/`,
`/explorer`, `/espace` sont inchangés. Il n'y a **pas** de `src/app/layout.tsx` ;
chaque groupe porte son propre `<html>`/`<body>`.

Pourquoi : tout le chrome applicatif (en-tête, palette ⌘K, TanStack Query,
supabase-js, bandeau d'abonnement, PWA) est fait de composants clients. Tant
qu'il vivait dans un layout commun, la vitrine téléchargeait et hydratait ce
JavaScript sans en afficher un pixel (`AppHeader` renvoie `null` sur `/`).
Mesuré sur un build de production : **502 → 318 kB gz** de JS sur la landing,
et `/` repasse de `ƒ` (rendue à chaque requête) à `○` (statique, servie par le
CDN). Le prix : passer de la vitrine à l'app recharge la page — sans effet,
c'est déjà une frontière de sous-domaine en production.

```
(vitrine)/                  Layout racine sans provider client
  /                         Landing publique (statique)
  /cgu  /mentions-legales  /confidentialite

(app)/                      Layout racine + chrome applicatif
  /explorer                 Vue principale (carte)
  /explorer/[maille]/[code] État d'URL avec sélection
  /analyser                 Analyse de territoire
    /comparateur  /simulateur  /marginalite  /sociologie  /potentiel  /ciblage
  /espace                   QG — tableau de bord « aujourd'hui »
    /plan                   Cible, objectif de voix, secteurs, épingles
    /terrain                Actions, permanences, porte-à-porte, phoning
    /equipe                 Membres & rôles, contacts, notes
  /circo/[code]  /commune/[insee]  /bureau/[code]
  /candidat/[id]  /elu/[id]
  /bienvenue                Accueil post-inscription (essai démarré, premiers pas)
  /auth
    /login
    /signup                 Démarrage de l'essai gratuit (14 jours)
    /callback               Retour du lien de confirmation e-mail (échange PKCE)
    /abonnement             Tarifs publics + checkout + gestion (résilier/reprendre)
    /team                   Réglages d'équipe (invitations, création de rôles)
  /[...introuvable]         Attrape-tout → 404 maison (cf. ci-dessous)
```

> **404** — sans layout racine commun, Next n'a plus d'endroit où composer une
> 404 globale et retombe sur sa page par défaut en anglais. Le segment
> attrape-tout `(app)/[...introuvable]` appelle `notFound()` et rend la 404
> maison. Les routes déclarées ont la priorité ; un visiteur non connecté n'y
> arrive pas (le proxy renvoie toute URL inconnue vers la connexion).

Les fiches territoire `/circo/[code]` et `/commune/[insee]` et les fiches personne `/candidat/[id]` et `/elu/[id]` sont implémentées (historique multi-scrutins, sociologie INSEE, classement, enrichissement nominatif). L'onglet `Suivre` (sondages, Assemblée, agenda, parrainages, soirée électorale) a été retiré — le produit se concentre sur Explorer, Analyser et le QG de campagne. Tout son code reste récupérable dans l'historique git.

## Comptes & abonnement

Parcours self-service complet : **inscription → essai 14 jours** (démarré
automatiquement par le trigger `handle_new_user`, sans carte bancaire) →
**accueil `/bienvenue`** (découverte des 3 piliers) → **bandeau d'essai**
global (jours restants, pressant à ≤ 3 jours) → **souscription
`/auth/abonnement`** (Solo 49 €/mois ou 490 €/an, Équipe 199 €/mois ou
1 990 €/an, Cabinet sur devis) → **changement de formule/cycle, résiliation à
l'échéance, reprise**.

Deux moteurs de facturation, choisis automatiquement (voir
[`docs/stripe.md`](docs/stripe.md)) :

- **Stripe** (carte) quand `STRIPE_SECRET_KEY` + `SUPABASE_SERVICE_ROLE_KEY`
  sont configurées : souscription via Stripe Checkout, gestion (formule,
  résiliation, factures, moyen de paiement) via le Billing Portal, état
  synchronisé dans `profiles` par le webhook `/api/stripe/webhook`
  (idempotent, table `stripe_events`).
- **« Activation immédiate, facture à réception »** en repli (dev/preview,
  clients par virement) : RPC `self_set_plan`/`self_cancel`/`self_resume`.

Chaque commande/changement est tracé dans `billing_events` (montant figé) —
c'est la « boîte de réception » facturation du back-office, quel que soit le
moteur.

- Gating : `src/proxy.ts` lit les claims JWT (`subscription_status`,
  `trial_ends_at`, `cancel_at`) — règle partagée `computeAccess` de
  `src/lib/billing.ts` (testée par Vitest).
- Grille tarifaire : `src/lib/team.ts` (affichage), `billing_price_eur()`
  côté SQL (mode facture) **et** les prix Stripe (relancer
  `scripts/stripe/bootstrap-products.mjs`) — à modifier ensemble.
- Migrations : `20260708_self_service_billing.sql` (appliquée en prod le
  2026-07-09) puis `20260709_stripe_billing.sql` — **à appliquer avant de
  déployer** le paiement carte. Sans elles, le checkout affiche proprement
  « pas encore ouvert » et le reste du parcours (essai, découverte) fonctionne
  à l'identique.

> Fiches personne — l'`id` est déterministe : `/candidat/{scrutin}__{circo}__{slug-nom}` et `/elu/{circo}` (ou `/elu/{scrutin}__{circo}`). Le prénom et le sexe proviennent des PV par bureau de vote (législatives 2024), précalculés dans `public/electoral/personnes-2024.json` via `scripts/pipeline/build-personnes.py`.

> Députés en exercice — `scripts/pipeline/build-deputes.py` télécharge le dataset officiel AMO40 de l'Assemblée nationale (17ᵉ législature) et produit `public/an/deputes.json` (identité, circonscription, **groupe parlementaire courant** avec sa couleur officielle). Ces 577 députés sont **recherchables dans ⌘K** (→ `/elu/{circo}`) et enrichissent la fiche élu (groupe + date de mandat).

> Activité parlementaire — `scripts/pipeline/build-deputes-activite.py` extrait des scrutins AN les **votes nominatifs** sur les votes publics solennels et motions de censure (17ᵉ législature) → `public/an/deputes-activite.json`. La fiche élu affiche la **participation**, la **loyauté au groupe** (alignement sur la position majoritaire) et le détail des votes (Pour / Contre / Abstention / Absent) par scrutin.

## Architecture du code

```
src/
  app/
    (vitrine)/layout.tsx    Layout racine vitrine (fontes + thème, zéro provider)
    (app)/layout.tsx        Layout racine app (chrome complet)
    (app)/espace/           QG : layout (contexte + rôle) puis 4 sections
      espace-shell.tsx      Contexte d'équipe + navigation des sections
      routes.ts             Plan de routes + redirections des anciens ?tab=
    globals.css, manifest.ts, robots.ts, sitemap.ts, opengraph-image.tsx…
  components/
    app-header.tsx          Header global + bouton recherche (déclenche ⌘K)
    command-palette.tsx     CommandDialog + raccourcis ⌘K et F (focus mode)
    landing-session.tsx     Détection de session sur la vitrine, sans supabase-js
    map.tsx                 Wrapper MapLibre (PMTiles + fond IGN)
  providers/
    query-provider.tsx      QueryClientProvider TanStack Query
    theme-provider.tsx      Thème Appica UI (light/dark/system)
  lib/
    utils.ts                cn() et helpers
```

### Le QG : 4 sections, et des rôles

`/espace` tenait dans **une seule route à dix onglets** (`?tab=`), qui importait
statiquement ses dix vues : ouvrir le phoning chargeait aussi la carte du
porte-à-porte et le calendrier des permanences. Les dix onglets sont regroupés
en quatre sections, chacune un vrai segment de route (donc son propre lot de
code) ; à l'intérieur, la vue reste un paramètre `?vue=`.

| Section | Regroupe | Pour qui |
| --- | --- | --- |
| `/espace` — Aujourd'hui | tableau de bord | tout le monde, adapté au rôle |
| `/espace/plan` | Campagne + Territoire + Épingles | édité par le responsable |
| `/espace/terrain` | Actions, Permanences, Porte-à-porte, Phoning | tout le monde |
| `/espace/equipe` | Membres & rôles, Contacts, Notes | tout le monde |

Les anciens liens `/espace?tab=…` sont redirigés (`LEGACY_TAB_REDIRECTS`).

**Rôles** — deux notions distinctes, à ne pas confondre :

- le **rôle structurel** `WsRole` (`owner` / `member`), dérivé de
  `profiles.role` et de `teams.created_by`, sans migration. Un espace sans
  équipe vaut `owner` ;
- les **rôles de campagne** (`team_roles` : « Logistique », « Responsable
  terrain »…), étiquettes libres définies par l'équipe, qui n'ouvrent aucun
  droit.

Ce que le rôle change : l'ordre des sections (le terrain d'abord pour un
membre), le contenu du tableau de bord (« mes actions » plutôt que celles de
toute l'équipe), la checklist de prise en main (responsable seulement) et
l'édition du plan — cible, objectif de voix, création/suppression de secteurs.
Le **compte rendu de terrain** (statut d'un secteur, contactés, favorables)
reste ouvert à tous : c'est le travail des membres.

> ⚠️ **Garde-fou d'interface uniquement.** Les politiques RLS de `campaigns` et
> `sectors` sont à l'échelle de l'équipe : un membre déterminé peut encore
> écrire via l'API. Aligner la base demande une migration dédiée (restreindre
> `UPDATE`/`INSERT` sur `campaigns` et sur les colonnes de plan de `sectors` au
> créateur de l'équipe) — non appliquée ici.

## Raccourcis

- `⌘K` / `Ctrl+K` : ouvre la palette de commandes (navigation + actions)
- `F` (en dehors d'un input) : bascule le mode focus (à câbler avec une classe `.focus-mode` masquant le chrome — utile pour les présentations)

## PWA (installation & hors-ligne)

L'app est installable (écran d'accueil / dock) et garde un socle hors-ligne :

- **Manifest** `src/app/manifest.ts` : icônes PNG + maskable (générées par
  `scripts/pipeline/build-icons.mjs`, versionnées), raccourcis (Explorer, QG)
  et captures d'installation
  (`scripts/pipeline/build-screenshots.mjs`, compte E2E requis).
- **Service worker** `public/sw.js` (enregistré en production par
  `src/components/pwa.tsx`) : navigations réseau-d'abord avec secours
  `/offline` précaché ; `/_next/static`, `/icons` et fonts en cache-first ;
  JSON figés du storage public (choroplèthes, détails, analyses) en
  stale-while-revalidate plafonné. Jamais : `/api/*`, auth/REST Supabase,
  requêtes Range (PMTiles). **Bump `VERSION` dans sw.js pour invalider les
  caches** ; `/sw.js` est servi en `no-cache` (netlify.toml).
- **Installation** : item « Installer l'application » dans le menu compte
  (Chrome/Edge/Android, via `beforeinstallprompt`) + encart sur `/bienvenue`
  avec instructions iOS (`src/lib/pwa-install.ts`).

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

## Déploiement — vitrine & application (même marque)

Un **seul projet**, déployé une fois, peut servir la **vitrine** sur le domaine
racine et l'**application** sur un sous-domaine, via le routage par hôte du
middleware (`src/proxy.ts`).

1. **DNS / Netlify** : pointer `mouvancia.fr` **et** `app.mouvancia.fr` vers le
   même site Netlify (SSL géré pour les deux).
2. **Variable d'environnement** (Netlify → Site settings → Environment) :
   ```
   NEXT_PUBLIC_APP_URL=https://app.mouvancia.fr
   ```
   - Définie → split actif : `app.mouvancia.fr` sert l'app (`/` → `/explorer`),
     `mouvancia.fr` sert la vitrine et **renvoie (308)** les routes applicatives
     (`/explorer`, `/analyser`, `/espace`, `/auth`, …) vers le sous-domaine app.
   - **Absente** (local/dev) → tout reste sur un seul host, comportement inchangé.

Itération indépendante : modifier la vitrine n'affecte pas le runtime de l'app,
et les Deploy Previews Netlify (par branche/PR) permettent de prévisualiser sans
risque. Le découpage n'est pas qu'un routage d'hôte : les deux surfaces ont des
**layouts racines distincts** (`(vitrine)` / `(app)`, cf. « Structure des
routes »), donc des arbres de composants et des bundles séparés.

## Observabilité & tests

- **Sentry** (erreurs client, serveur, edge) : définir `NEXT_PUBLIC_SENTRY_DSN`
  dans l'environnement Netlify pour activer la remontée — sans la variable,
  tout est no-op (dev, previews). Optionnel : `SENTRY_AUTH_TOKEN` au build pour
  uploader les source maps (init runtime : `src/instrumentation*.ts`).
- **Tests unitaires** : `npm test` (Vitest, logique pure de `src/lib`).
- **Tests E2E** : `npm run test:e2e` (Playwright). La suite publique (landing,
  gating, erreurs d'auth en français) tourne sans configuration ; la suite
  authentifiée (Explorer, QG) nécessite `E2E_EMAIL` / `E2E_PASSWORD`
  (compte de test avec abonnement) + les `NEXT_PUBLIC_SUPABASE_*` réelles.
- **CI** (`.github/workflows/ci.yml`) : lint + types + Vitest + Playwright sur
  chaque PR.
- **Migrations Supabase** : versionnées dans `supabase/migrations/` —
  appliquées manuellement (voir l'en-tête de chaque fichier).

## Conformité

- RGPD : pas de données personnelles d'électeurs (uniquement agrégats publics).
- Neutralité : codes couleurs partisans alignés sur les conventions du ministère de l'Intérieur, à implémenter dans les couches de la carte.
