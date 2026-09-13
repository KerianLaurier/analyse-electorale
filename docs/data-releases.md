# Publications cohérentes des données

Le mode historique continue à accepter les mises à jour partielles des workflows existants. Il n'est **pas atomique**. Pour une publication cohérente, préparer un jeu complet dans `public/`, puis utiliser un identifiant unique :

```sh
RELEASE_ID=2026-09-12-a DRY_RUN=1 node scripts/pipeline/upload-storage.mjs
RELEASE_ID=2026-09-12-a node scripts/pipeline/upload-storage.mjs
```

Les variables Supabase habituelles doivent être présentes dans l'environnement privé. Le mode release exige les quatre familles `electoral`, `tiles`, `insee`, `an` et l'index de recherche. Les objets sont créés sous `releases/<id>/` sans écrasement ; le manifeste SHA-256 est écrit uniquement si tous les fichiers ont réussi. Les fichiers JSON doivent être syntaxiquement valides et aucun fichier ne peut être vide. Cela ne remplace pas la validation statistique de leur contenu.

Après vérification du manifeste, configurer `NEXT_PUBLIC_DATA_URL` sur l'URL publique terminant par `/data/releases/<id>`, puis reconstruire l'application. Ce changement de build sélectionne une version unique pour toutes les données ; les sessions déjà ouvertes continuent à utiliser leur ancienne version. Pour revenir en arrière, reconstruire avec l'ancienne URL. Conserver les releases précédentes tant qu'un ancien déploiement peut encore les lire.

Une publication interrompue ne reçoit pas de manifeste. Reprendre avec un nouvel identifiant : ne pas réutiliser un identifiant dont les objets ont déjà été créés. Le stockage résiduel peut ensuite être supprimé après vérification qu'aucun déploiement ne le référence.

Le passage des workflows existants à un pipeline complet et la sélection d'une première release nécessitent la génération de toutes les sources. Ce document et le script ne prétendent pas avoir généré ou activé ces données en production.
