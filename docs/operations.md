# Exploitation et limites de validation

## Déploiement

Le schéma de référence `supabase/schema/public-before-hardening.sql` décrit la structure de référence utilisée pour les tests. Il ne contient aucune ligne utilisateur. Les tests PGlite reconstruisent les 19 tables initiales, leurs contraintes, index, droits de colonnes, politiques et fonctions. Ils utilisent un schéma Auth minimal : ils ne reproduisent pas l’intégralité du service Supabase.

Appliquer les migrations `202609*.sql` dans l’ordre et en transaction avant de basculer le frontend correspondant. Les statuts de paiement personnels existants ne sont pas réécrits. Le nouveau titulaire de facturation des équipes est initialisé depuis leur propriétaire actuel. Toute inscription à l’allowlist de facturation hors Stripe doit correspondre à une décision commerciale explicite.

La nouvelle page admin nécessite `admin_accounts_page`. La création de compte nécessite aussi `SUPABASE_SERVICE_ROLE_KEY` côté serveur et l’API Auth officielle. L’ancienne RPC de création devient inaccessible aux clients. Prévoir une courte fenêtre coordonnée pour ces changements ; ne pas utiliser l’ancienne interface admin après révocation de la RPC.

## Cache de compilation

Le cache persistant de Turbopack pour `next build` est désactivé : il peut conserver des valeurs de variables serveur dans ses fichiers internes. Le script `prebuild` supprime les caches Turbopack précédents, y compris une copie restaurée par Netlify. Les autres fichiers générés et les données de l’application ne sont pas visés. Le coût est une compilation moins réutilisable entre builds.

La CI construit avec une valeur Stripe fictive puis contrôle son absence dans `.next` et `public` avec `npm run check:build-secrets`. Le contrôle Netlify reste actif, sans exclusion de secret ni de chemin. Références : [cache Turbopack](https://nextjs.org/docs/app/api-reference/config/next-config-js/turbopackFileSystemCache), [contrôle Netlify](https://docs.netlify.com/manage/security/secret-scanning/).

## Facturation

Chaque compte possède au maximum une réservation Checkout. Une requête en reprise utilise les paramètres stockés et la même clé d’idempotence Stripe. Une session ouverte est réutilisée, une session payée attend sa réconciliation, une session n’est renouvelée qu’après confirmation d’expiration par Stripe. Les prix du catalogue doivent correspondre au montant et à la période affichés : un écart bloque le paiement plutôt que de facturer un montant inattendu.

Les webhooks sont sérialisés par client Stripe. Un bail expiré ou remplacé interdit l’écriture d’une ancienne réponse. Les événements rejoués sont dédupliqués dans la même transaction que la mise à jour du profil et du journal. Une contention ou une erreur retourne HTTP 500 pour permettre la reprise Stripe.

Une tentative sans `session_id`, ancienne de plus que la fenêtre d’idempotence Stripe, peut nécessiter une réparation : rechercher la session par client et `metadata.checkout_attempt`, vérifier son état réel et rattacher l’identifiant. Ne jamais libérer la réservation sur le seul constat de son âge. Une session payée ne doit jamais être remplacée par un second paiement.

Le comportement `past_due` conserve la logique existante ; il doit être validé comme choix commercial. La sérialisation évite les écritures concurrentes périmées, mais le classement métier d’un événement historique réconcilié avec un état plus récent mérite encore une revue. Les alertes Stripe sur les livraisons en erreur et une réconciliation périodique doivent être configurées dans l’environnement d’exploitation ; elles ne sont pas activées par ces fichiers.

## Sièges partagés

La formule Équipe couvre **cinq personnes au total, titulaire inclus**. Un essai valide offre également cinq sièges pour essayer la collaboration ; Solo en couvre un et Cabinet conserve les sièges illimités annoncés. `teams.billing_owner_id` désigne le compte dont l’offre finance l’équipe. Transférer `created_by` transfère la gestion, jamais le mandat Stripe.

Avant application, exécuter le contrôle en lecture seule `supabase/preflight/shared-team-seats.sql`. Vérifier les équipes dépassant la capacité de leur propriétaire et les membres ayant déjà leur propre abonnement. La migration initialise le titulaire depuis le propriétaire actuel : si ce compte n’est pas le payeur commercial attendu, préparer un rattachement explicite avant la bascule. Aucun abonnement personnel n’est automatiquement résilié ni remboursé. Les membres couverts conservent l’accès à leur portail personnel.

Les invitations verrouillent l’équipe et comptent le titulaire. Un compte expiré peut rejoindre une équipe disposant d’un siège depuis `/auth/team`. Une réservation Checkout personnelle non réconciliée bloque l’invitation, même si sa date d’expiration est passée : confirmer d’abord son état auprès de Stripe. Les nouvelles souscriptions personnelles sont refusées pour les membres déjà couverts, y compris sous verrou SQL ; la résiliation d’une ancienne souscription reste possible.

Après expiration ou réduction de capacité, les données restent présentes. L’ordre d’attribution est déterministe : titulaire, propriétaire, puis ancienneté du compte et identifiant. Les personnes hors quota perdent le partage ; un abonnement personnel valide conserve leur espace personnel. La page de compte reste accessible pour gérer l’équipe et la facturation. Le titulaire d’un abonnement actif ne peut quitter l’équipe avant régularisation ; après fin de son abonnement et transfert de propriété, son départ rattache la facturation au propriétaire restant sans créer de paiement.

Le statut personnel `inactive` n’est donc pas une suspension globale d’utilisateur : un siège d’équipe valide peut encore ouvrir l’accès. Une fonction distincte de suspension administrative n’est pas introduite par ce lot.

## Accès et confidentialité

La base contrôle désormais l’accès aux tables de travail avec le statut courant d’abonnement, sans attendre le renouvellement d’un JWT. L’appartenance à l’équipe, la propriété des lignes et les liens parent/enfant sont vérifiés. Un propriétaire doit transférer l’équipe avant de la quitter. Le transfert conserve les membres et les données.

Sentry conserve la localisation des erreurs et retire les requêtes, utilisateurs, contenus libres, breadcrumbs et variables. Les traces de performance sont désactivées jusqu’à validation de leurs attributs. La CSP est en mode `Report-Only` : ce n’est pas une protection de blocage et aucun collecteur de rapports n’est configuré. Valider ses origines sur le déploiement avant de la rendre contraignante.

La liste d’attente accepte des corps de 4 Ko maximum et 60 requêtes valides par minute pour toute l’application. Ce quota global protège les écritures ; il peut aussi être saturé par une source malveillante. Une limite par origine réseau au niveau de l’hébergeur peut le compléter. Aucun historique d’IP n’est ajouté par ce correctif.

## Sauvegardes et décisions à fournir

Le relevé SQL contient une structure, **pas une sauvegarde des données**. Avant une opération destructive ou une refonte de données, configurer une sauvegarde appropriée et tester sa restauration sur une instance isolée. Les objectifs de perte maximale de données et de délai de reprise restent à fixer par l’éditeur.

Restent des décisions organisationnelles : finalités et bases applicables aux données personnelles, durées par catégorie, personne chargée des demandes d’accès/effacement, sous-traitants et mentions légales. Ne pas inventer ces informations ni appliquer une purge automatique arbitraire. Les protections techniques de ce lot ne constituent pas une certification juridique.

## Limites restantes

La pagination serveur est livrée pour l’administration. Le chargement des grandes collections métier, notamment les contacts par liste, reste à refondre avant un déploiement à grande échelle. Les mutations privées sont isolées par identité ; les tâches disposent d’une révision serveur et refusent une modification périmée. Ce mécanisme reste à étendre aux autres stores. Les dépendances Python et leurs empreintes sont verrouillées ; quatre contrats sur fixtures couvrent l’index territorial. La validation des autres agrégations et le verrouillage des outils de tuilage restent à compléter. Le mode de publication immuable est disponible, mais aucun jeu complet n’a été généré ni activé en production durant cette intervention.

Les tests PGlite vérifient les règles et les limites de sièges mais ne remplacent pas un essai de contention sur plusieurs connexions PostgreSQL/Supabase. Les tests de rôles utilisent la structure réelle et plus de 1 000 comptes fictifs. Il reste à faire sur un environnement isolé : parcours Auth multi-onglets réels, paiement Stripe en mode test, restauration de sauvegarde, parcours de récupération de mot de passe et budgets de performance mobile. Aucun niveau de capacité ou score Lighthouse n’est revendiqué.
