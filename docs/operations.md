# Exploitation et limites de validation

## Déploiement

Le schéma de référence `supabase/schema/public-before-hardening.sql` a été reconstruit depuis le catalogue de production le 12 septembre 2026. Il ne contient aucune ligne utilisateur. Les tests PGlite reconstruisent les 19 tables initiales, leurs contraintes, index, droits de colonnes, politiques et fonctions. Ils utilisent un schéma Auth minimal : ils ne reproduisent pas l’intégralité du service Supabase.

Appliquer les migrations `202609*.sql` dans l’ordre et en transaction avant de basculer le frontend correspondant. Les colonnes des comptes existants ne sont pas réécrites. L’allowlist de facturation hors Stripe reste vide : les deux comptes actifs sans Stripe ont été identifiés comme comptes de test par l’éditeur. Une inscription à cette allowlist doit correspondre à une décision commerciale explicite.

La nouvelle page admin nécessite `admin_accounts_page`. La création de compte nécessite aussi `SUPABASE_SERVICE_ROLE_KEY` côté serveur et l’API Auth officielle. L’ancienne RPC de création devient inaccessible aux clients. Prévoir une courte fenêtre coordonnée pour ces changements ; ne pas utiliser l’ancienne interface admin après révocation de la RPC.

## Facturation

Chaque compte possède au maximum une réservation Checkout. Une requête en reprise utilise les paramètres stockés et la même clé d’idempotence Stripe. Une session ouverte est réutilisée, une session payée attend sa réconciliation, une session n’est renouvelée qu’après confirmation d’expiration par Stripe. Les prix du catalogue doivent correspondre au montant et à la période affichés : un écart bloque le paiement plutôt que de facturer un montant inattendu.

Les webhooks sont sérialisés par client Stripe. Un bail expiré ou remplacé interdit l’écriture d’une ancienne réponse. Les événements rejoués sont dédupliqués dans la même transaction que la mise à jour du profil et du journal. Une contention ou une erreur retourne HTTP 500 pour permettre la reprise Stripe.

Une tentative sans `session_id`, ancienne de plus que la fenêtre d’idempotence Stripe, peut nécessiter une réparation : rechercher la session par client et `metadata.checkout_attempt`, vérifier son état réel et rattacher l’identifiant. Ne jamais libérer la réservation sur le seul constat de son âge. Une session payée ne doit jamais être remplacée par un second paiement.

Le comportement `past_due` conserve la logique existante ; il doit être validé comme choix commercial. La sérialisation évite les écritures concurrentes périmées, mais le classement métier d’un événement historique réconcilié avec un état plus récent mérite encore une revue. Les alertes Stripe sur les livraisons en erreur et une réconciliation périodique doivent être configurées dans l’environnement d’exploitation ; elles ne sont pas activées par ces fichiers.

## Accès et confidentialité

La base contrôle désormais l’accès aux tables de travail avec le statut courant d’abonnement, sans attendre le renouvellement d’un JWT. L’appartenance à l’équipe, la propriété des lignes et les liens parent/enfant sont vérifiés. Un propriétaire doit transférer l’équipe avant de la quitter. Le transfert conserve les membres et les données.

Sentry conserve la localisation des erreurs et retire les requêtes, utilisateurs, contenus libres, breadcrumbs et variables. Les traces de performance sont désactivées jusqu’à validation de leurs attributs. La CSP est en mode `Report-Only` : ce n’est pas une protection de blocage et aucun collecteur de rapports n’est configuré. Valider ses origines sur le déploiement avant de la rendre contraignante.

La liste d’attente accepte des corps de 4 Ko maximum et 60 requêtes valides par minute pour toute l’application. Ce quota global protège les écritures ; il peut aussi être saturé par une source malveillante. Une limite par origine réseau au niveau de l’hébergeur peut le compléter. Aucun historique d’IP n’est ajouté par ce correctif.

## Sauvegardes et décisions à fournir

Le tableau de bord de production n’affichait aucune sauvegarde disponible lors du contrôle. Le relevé SQL est une sauvegarde de structure, **pas une sauvegarde des données**. Avant une opération destructive ou une refonte de données, configurer une sauvegarde appropriée et tester sa restauration sur une instance isolée. Les objectifs de perte maximale de données et de délai de reprise restent à fixer par l’éditeur.

Restent des décisions organisationnelles : finalités et bases applicables aux données personnelles, durées par catégorie, personne chargée des demandes d’accès/effacement, sous-traitants et mentions légales. Ne pas inventer ces informations ni appliquer une purge automatique arbitraire. Les protections techniques de ce lot ne constituent pas une certification juridique.

## Limites restantes

La pagination serveur est livrée pour l’administration. Le chargement des grandes collections métier, notamment les contacts par liste, reste à refondre avant un déploiement à grande échelle. Les mutations privées sont isolées par identité ; les tâches disposent d’une révision serveur et refusent une modification périmée. Ce mécanisme reste à étendre aux autres stores. Les dépendances Python et leurs empreintes sont verrouillées ; quatre contrats sur fixtures couvrent l’index territorial. La validation des autres agrégations et le verrouillage des outils de tuilage restent à compléter. Le mode de publication immuable est disponible, mais aucun jeu complet n’a été généré ni activé en production durant cette intervention.

Les tests de rôles utilisent la structure réelle et plus de 1 000 comptes fictifs. Il reste à faire sur un environnement isolé : parcours Auth multi-onglets réels, paiement Stripe en mode test, restauration de sauvegarde, parcours de récupération de mot de passe et budgets de performance mobile. Aucun niveau de capacité ou score Lighthouse n’est revendiqué.
