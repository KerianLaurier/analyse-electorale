# État de mise en œuvre de l’audit

Mis à jour le 13 septembre 2026. Ce document complète l’audit initial et distingue le code livré des protections effectivement activées. Le schéma relevé contient la structure, aucune donnée utilisateur.

## Changements livrés

| Constats de l’audit | Mise en œuvre | Limites à conserver en vue |
|---|---|---|
| 1–3, 5–8 : facturation et sessions | Transaction profil/journal/événement Stripe, fermeture de l’activation libre hors Stripe, accès au paiement depuis un compte expiré, validation et reprise des routes, cookies renouvelés, retour de paiement resynchronisé. | Déploiement coordonné des fonctions SQL et du frontend nécessaire. |
| 4 : dépendances | Versions corrigées dans le lockfile, Next 16.3.4, MapLibre 6.4.1. Worker ESM et module partagé copiés automatiquement avant dev/build ; ressources publiques exclues du proxy. | WebGL 2 requis par MapLibre 6. Vérification des navigateurs cibles à compléter. |
| 9–12 : erreurs, exports, pipeline, CI | Retours de sauvegarde explicites, conservation des formulaires, restauration locale, neutralisation des formules CSV, suppression des promesses rejetées du cache, ordre du pipeline et contrôles CI. | Les traitements de concurrence ne sont pas encore uniformes sur toutes les collections. |
| 13 : double souscription | Réservation Checkout durable par compte, clé d’idempotence stable, paramètres conservés, expiration confirmée auprès de Stripe avant renouvellement. | Réconciliation manuelle documentée pour une tentative ancienne dont l’identifiant Stripe n’a pas été rattaché. |
| 14, 23 : droits réels | Référence des 19 tables initiales ; migrations rejouées sur cette structure avec RLS et droits de colonnes. Propriété immuable, liens parent/enfant contrôlés, accès conditionné au statut courant, transfert d’équipe encadré, édition du plan réservée au propriétaire. | Types Supabase générés, revue de l’exposition des colonnes de profil entre membres et application des quotas commerciaux de sièges restent à traiter. |
| 15, 25 : confidentialité et exploitation | Minimisation des événements Sentry, traces de performance désactivées, modules privilégiés marqués `server-only`, CSP de diagnostic, documentation d’exploitation. | Règles de conservation, export/effacement, mentions légales, MFA, sauvegarde et restauration à définir/configurer. CSP non bloquante et sans collecteur. |
| 16 : changements d’identité | Générations d’identité, annulation des résolutions périmées, séparation des caches par utilisateur/équipe, neutralisation des mutations tardives, propagation entre onglets et au retour au premier plan. | Parcours Auth multi-onglets réel encore à valider sur une instance isolée. |
| 17 : conflits | Tâches protégées par une révision serveur ; écriture conditionnelle et restauration de la seule entité concernée, y compris après exception réseau. | Étendre ce mécanisme aux notes, contacts, campagnes, créneaux et autres stores. |
| 18 : volumes | Recherche, totaux et pagination administrateur effectués côté base, 50 comptes par page. Test sur 1 053 comptes fictifs. | Les grandes listes métier et contacts par liste ne sont pas encore paginés côté serveur. Aucun chiffre de capacité n’est garanti. |
| 19 : caches publics | Caches LRU bornés dans les modules de données ; cache service worker limité en nombre et taille, exclusion des API privées et des Range, continuité réseau si le stockage échoue. | Mesures mémoire sur les parcours les plus longs à réaliser. |
| 20 : publication de données | Mode de publication sous un identifiant de release immuable, empreintes des fichiers, manifeste publié en dernier, guide d’activation et retour à une version antérieure. | Les workflows partiels historiques restent actifs ; aucune release complète n’a été générée ni activée ici. |
| 21 : reproductibilité | Dépendances Python 3.13 verrouillées avec empreintes, installation vérifiée, workflows alignés. Index territorial validé puis remplacé atomiquement ; fixtures codes, accents, sources absentes et doublons. | Couvrir les autres agrégations et fixer les versions des outils externes de tuilage et des sources téléchargées. |
| 22 : exploitation Stripe | Sérialisation par client et rejet d’un bail périmé ; contrôle du montant/période/devise du catalogue avant paiement. | Alertes et rapprochement périodique non activés. Politique `past_due` à confirmer comme choix commercial. |
| 24 : abus publics | Corps de liste d’attente borné à 4 Ko, quota atomique global partagé, validation d’origine/format de la nouvelle route admin. | Protection réseau par source au niveau de l’hébergeur non configurée. |
| 26 : analyses | Terminologie exploratoire, distinction entre ajustement historique et validation prédictive, réserve sur les intervalles. | Les modèles n’ont pas été recalibrés ni validés sur un échantillon indépendant. |
| 27 : architecture | Modules dédiés à l’identité privée, aux caches, à la réservation Checkout, au catalogue, au corps HTTP et à la télémétrie. | Décomposition des grands écrans et validation exhaustive des contrats JSON encore à poursuivre. |
| 28 : tests réels | Tests PostgreSQL embarqué basés sur le schéma relevé, tests unitaires, parcours publics sur build de production et contrôle visuel des interfaces modifiées avec fixtures. | Ni paiement réel, ni écriture d’un utilisateur fictif, ni transfert d’une équipe réelle n’a été exécuté en production. |

## Déploiement du lot

Les neuf migrations de septembre doivent être appliquées dans l’ordre avec suivi de leur version. Le bundle remis dans les livrables les rassemble dans une transaction avec délais de verrouillage/exécution bornés. Ne pas rejouer les anciennes migrations ni la référence initiale sur la production.

La nouvelle administration appelle `admin_accounts_page` et une route utilisant l’API Auth officielle. L’ancien appel `admin_create_account` est révoqué. Le Checkout et le webhook appellent également les nouvelles fonctions. Préparer le frontend et les variables serveur avant la fenêtre de bascule, appliquer le SQL, puis déployer la version correspondante. Un déploiement du frontend seul n’est pas compatible.

En cas d’échec avant COMMIT, annuler la transaction entière ; aucune nouvelle migration n’est alors conservée. Après COMMIT, privilégier un correctif en avant et conserver les journaux Stripe et réservations. Ne pas supprimer ces tables pour revenir à une ancienne version. Une restauration des données nécessite une sauvegarde vérifiée ; aucun script ne doit réouvrir silencieusement les RPC vulnérables.

## Fonctionnalités futures

Voir [les propositions et références concurrentielles](feature-roadmap.md). Ce sont des propositions, pas des fonctionnalités implémentées dans ce lot. Priorité recommandée : provenance des chiffres, dossiers d’analyse sauvegardés et partage révocable avec exports sourcés.
