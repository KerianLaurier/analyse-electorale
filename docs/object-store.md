# Données hors git → Supabase Storage

Les données statiques servies (Parquet électoraux, PMTiles, JSON pré-calculés)
pèsent ~95 Mo et sont aujourd'hui **versionnées dans git**. Le dépôt gonfle à
chaque rafraîchissement du pipeline. Cette procédure les déplace vers **Supabase
Storage** et permet de les retirer du dépôt.

L'app lit déjà ces fichiers via `dataUrl()` (`src/lib/data-url.ts`) :

- `NEXT_PUBLIC_DATA_URL` **absente** → service depuis `/public` (comportement actuel) ;
- **définie** (ex. URL publique du bucket) → service depuis l'object store.

La bascule est donc un simple flip de variable, **réversible** tant que les
fichiers restent dans git.

## Le plus simple : la GitHub Action (aucun terminal)

1. **Ajouter le secret.** Dashboard Supabase → *Project Settings* → *API* →
   copier la clé **`service_role`**. Sur GitHub : *Settings → Secrets and
   variables → Actions → New repository secret*, nom
   **`SUPABASE_SERVICE_ROLE_KEY`**, coller la valeur.
2. **Lancer l'upload.** Onglet *Actions* → workflow **« Upload data → Supabase
   Storage »** → *Run workflow*. Il crée le bucket public `data` et y pousse
   les ~95 Mo depuis le dépôt.
3. **Pointer l'app** : définir `NEXT_PUBLIC_DATA_URL` (voir ci-dessous) puis
   redéployer.
4. **Vérifier** puis **retirer de git** (voir §Vérifier et §Retirer).

## Variante manuelle (terminal)

Aucune installation préalable : le script n'a aucune dépendance (`fetch` natif,
Node ≥ 18).

```bash
SUPABASE_URL=https://fdfghtrxczauvrbmdxlq.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role> \
node scripts/pipeline/upload-storage.mjs        # DRY_RUN=1 pour lister sans écrire
```

> Cette absence de dépendance est délibérée : les 5 workflows qui appellent ce
> script faisaient auparavant un `npm ci` complet (~790 paquets) pour trois
> requêtes HTTP. Un `package-lock.json` cassé coupait donc la synchro des
> données alors que leur collecte fonctionnait (panne du 30/07 au 03/08 2026).
> Merci de ne pas réintroduire d'`import` tiers ici.

## Pointer l'app vers le bucket

URL publique d'un bucket Supabase Storage :

```
https://fdfghtrxczauvrbmdxlq.supabase.co/storage/v1/object/public/data
```

Définir dans Netlify (ou `netlify.toml`) :

```
NEXT_PUBLIC_DATA_URL = https://fdfghtrxczauvrbmdxlq.supabase.co/storage/v1/object/public/data
```

⚠️ Les `NEXT_PUBLIC_*` sont **inlinées au build** → un **redéploiement** est
nécessaire pour qu'un changement de variable prenne effet.

## Vérifier (avant de retirer quoi que ce soit de git)

Déployer, puis dans l'onglet réseau confirmer que :

- la carte charge les `*.pmtiles` depuis l'URL Storage (requêtes **Range** 206) ;
- l'explorateur / les analyses chargent les `*.parquet` depuis Storage
  (DuckDB-WASM httpfs = range requests — nécessite **CORS** et **Range**, tous
  deux fournis par défaut sur un bucket public Supabase) ;
- les fiches (commune_circo, personnes, députés…) chargent leurs JSON.

## Retirer les données du dépôt

Une fois la prod confirmée OK sur Storage, retirer les gros statiques :

```bash
git rm -r --cached public/electoral public/tiles public/insee public/an public/search-index.json
```

…puis ignorer ces chemins dans `.gitignore`, committer.

## Rollback

Désactiver `NEXT_PUBLIC_DATA_URL` → retour immédiat au service depuis `/public`
(valable tant que les fichiers n'ont pas été retirés). Après retrait, restaurer
depuis l'historique git ou régénérer via `scripts/pipeline/`.
