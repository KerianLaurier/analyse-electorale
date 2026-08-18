# PMTiles CORS Proxy — Cloudflare Worker

Proxy CORS pour les fichiers PMTiles hébergés sur `object.files.data.gouv.fr` qui
n'envoient pas les headers `Access-Control-Allow-Origin` requis par le navigateur.

## Pourquoi

Les PMTiles de contours de bureaux de vote (REU/Etalab, ~350 Mo) sont servis
par data.gouv.fr **sans** `Access-Control-Allow-Origin`. Le navigateur bloque
donc les requêtes `fetch` / `XMLHttpRequest` depuis l'app Mouvancia (localhost
ou mouvancia.fr).

Ce Worker ajoute les headers CORS manquants et met en cache les réponses
chez Cloudflare (24 h), ce qui accélère aussi le chargement des tuiles.

## Déploiement

```bash
cd workers/pmtiles-proxy
npm install
npx wrangler login        # une seule fois, ouvre le navigateur
npm run deploy
```

Le Worker obtient une URL du type :
`https://pmtiles-proxy.<ton-compte>.workers.dev`

## Utilisation dans l'app

Remplace dans `src/lib/map-config.ts` :

```ts
// AVANT
path: "https://object.files.data.gouv.fr/data-pipeline-open/reu/reu-france-entiere-2022-06-01-v2.pmtiles",

// APRÈS
path: "https://pmtiles-proxy.<ton-compte>.workers.dev/reu/reu-france-entiere-2022-06-01-v2.pmtiles",
```

Ou mieux : utilise une variable d'environnement `NEXT_PUBLIC_PMTILES_PROXY`
pour changer d'URL sans toucher au code.

## Test local

```bash
npm run dev
# Worker disponible sur http://localhost:8787
curl -I http://localhost:8787/reu/reu-france-entiere-2022-06-01-v2.pmtiles
# → doit retourner 200 + Access-Control-Allow-Origin: *
```

## Logs

```bash
npm run tail    # suit les logs en temps réel
```

## Coût

Cloudflare Workers : **100 000 requêtes/jour gratuites**. Pour une app
cartographique avec cache navigateur + cache Cloudflare, c'est très largement
suffisant (chaque tuile n'est fetchée qu'une fois par session utilisateur).
