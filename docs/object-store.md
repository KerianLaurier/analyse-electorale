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

## Étapes

### 1. Uploader les données

```bash
SUPABASE_URL=https://fdfghtrxczauvrbmdxlq.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<service_role_key> \
node scripts/pipeline/upload-storage.mjs
```

Crée le bucket public `data` (si absent) et y pousse, en conservant
l'arborescence : `electoral/`, `tiles/`, `insee/`, `sondages/`, `an/`, `suivi/`,
`parrainages/` et `search-index.json`. Idempotent (`upsert`). Variante
`DRY_RUN=1` pour lister sans écrire.

> Le `service_role` contourne la RLS Storage : à n'utiliser qu'en CI / local,
> jamais exposé au client.

### 2. Pointer l'app vers le bucket

URL publique d'un bucket Supabase Storage :

```
https://fdfghtrxczauvrbmdxlq.supabase.co/storage/v1/object/public/data
```

Définir dans Netlify (et, si voulu, les Deploy Previews) :

```
NEXT_PUBLIC_DATA_URL = https://fdfghtrxczauvrbmdxlq.supabase.co/storage/v1/object/public/data
```

### 3. Vérifier (avant de retirer quoi que ce soit de git)

Déployer, puis dans l'onglet réseau confirmer que :

- la carte charge les `*.pmtiles` depuis l'URL Storage (requêtes **Range** 206) ;
- l'explorateur / les analyses chargent les `*.parquet` depuis Storage
  (DuckDB-WASM httpfs = range requests — nécessite **CORS** et **Range**, tous
  deux fournis par défaut sur un bucket public Supabase) ;
- les fiches (commune_circo, personnes, députés…) chargent leurs JSON.

### 4. Retirer les données du dépôt

Une fois la prod confirmée OK sur Storage :

```bash
git rm -r --cached public/electoral public/tiles public/insee \
  public/sondages public/an public/suivi public/parrainages public/search-index.json
```

…puis ignorer ces chemins dans `.gitignore`, committer, et mettre à jour la
**GitHub Action quotidienne** (`notices.json`) pour qu'elle **uploade vers
Storage** (réutiliser `upload-storage.mjs`) au lieu de committer.

### Rollback

Désactiver `NEXT_PUBLIC_DATA_URL` → retour immédiat au service depuis `/public`
(valable tant que l'étape 4 n'a pas été faite). Après l'étape 4, restaurer les
fichiers depuis l'historique git ou les régénérer via `scripts/pipeline/`.
