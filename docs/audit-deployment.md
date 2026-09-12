# Mise en service des correctifs de l'audit du 10–11 septembre 2026

Les modifications sont préparées localement. Aucune migration, publication ou modification
des abonnements réels n'a été exécutée pendant l'audit.

## Préparer une base de test représentative

Le schéma initial Supabase n'est pas intégralement versionné dans ce dépôt. Les tests SQL
PGlite utilisent un schéma minimal explicite : ils vérifient les nouvelles transactions
et permissions, mais ne remplacent pas un test sur le véritable schéma Supabase.

Exporter et versionner le schéma sans données ni secrets, puis vérifier les tables `profiles`,
`billing_events`, `stripe_events`, leurs contraintes et les fonctions de facturation.
Les anciennes migrations utilisent notamment deux versions préfixées `20260610` : réconcilier
leur historique avant de passer à un outil de migration automatique, sans renommer aveuglément
les versions déjà enregistrées en production.

## Ordre d'application

1. Sauvegarder la base et vérifier qu'une restauration est possible. Répéter la procédure sur
   l'environnement de test.
2. Appliquer `20260910200000_atomic_stripe_events.sql`. Elle ajoute une RPC réservée au
   `service_role`. L'ancien webhook ne l'utilise pas encore.
3. Recenser les seuls comptes ayant un accord commercial de paiement sur facture. Préparer
   leurs UUID ; ne pas déduire cette autorisation du seul statut `active` ou de l'absence de client Stripe.
4. Appliquer `20260910201000_restrict_invoice_billing.sql`. Sa liste d'autorisation est vide
   par défaut. Elle ferme les anciennes RPC de facturation aux comptes non autorisés.
   Dans la même intervention, inscrire les clients facture approuvés via un administrateur SQL
   ou le service role. Exemple paramétré :

   ```sql
   insert into public.invoice_billing_accounts(user_id)
   values ($1::uuid)
   on conflict (user_id) do nothing;
   ```

   Ne pas y inscrire de compte déjà rattaché à Stripe : la garde SQL le refuse également.
   Les abonnements existants ne sont pas annulés par cette migration ; seules les opérations
   autonomes sur facture sont restreintes.
5. Vérifier la configuration serveur : `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
   `STRIPE_WEBHOOK_SECRET` et l'URL publique de l'application. Vérifier aussi que le webhook
   est bien enregistré et joignable dans Stripe. Une variable présente ne prouve pas cela.
6. Déployer le code après les deux migrations. Le nouveau webhook renvoie un échec rejouable
   si sa RPC est absente ; le déployer en premier empêcherait temporairement les activations.
7. Sur Stripe en mode test, vérifier : essai expiré → Checkout → activation ; retour avant et
   après webhook ; doublons ; échec de base puis rejeu ; changement de formule ; résiliation,
   reprise et impayé. Vérifier l'accès aux factures après expiration.
8. Rejouer les événements en échec dans Stripe et rapprocher les abonnements actifs Stripe
   des profils. Les événements acquittés à tort par l'ancien code ne sont pas réparés
   rétroactivement par la nouvelle transaction : il faut aussi examiner cet historique.

## Vérifications locales reproductibles

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run check:lock
bash -n scripts/pipeline/all.sh
python3 -m compileall -q scripts/pipeline
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder-anon-key npm run build
CI=true npm run test:e2e
```

La suite publique fonctionne avec les variables factices ; elle ne prouve pas l'écriture en
base. Les tests connectés sont ignorés sans `E2E_EMAIL` / `E2E_PASSWORD` et une base réelle de
test. Le test Stripe d'intégration exige une clé de test ; ne jamais lui fournir une clé live.

La mise à jour de MapLibre vers 6.4.1 demande un navigateur WebGL 2. Vérifier les cinq mailles,
les changements de thème, la sélection, le zoom et les choroplèthes sur mobile et ordinateur
avec des tuiles accessibles. L'hôte Supabase codé dans `netlify.toml` ne se résolvait pas depuis
l'environnement d'audit : le rendu des contrôles a été constaté, pas la validation complète des
fonds et des couches réels. Vérifier l'URL effective et le projet de stockage avant publication.

## Retour arrière

En cas de régression frontend, revenir au code précédent en conservant la restriction des
RPC facture. Un retour au webhook précédent réintroduit sa fenêtre de perte d'événement :
privilégier une correction en avant, surveiller les erreurs et réconcilier Stripe/base.
Ne pas supprimer les tables de déduplication ou le journal de facturation lors d'un rollback.
Ne pas réouvrir `self_set_plan` à tous les utilisateurs pour rétablir un parcours de paiement.

## Travaux encore nécessaires

- Versionner et tester toutes les politiques RLS, droits de colonnes et RPC métier.
- Réserver durablement une seule session Checkout ouverte par compte pour éviter deux
  souscriptions simultanées ; l'idempotence de création du client Stripe ne suffit pas.
- Sérialiser la réconciliation des événements par abonnement et ajouter un rapprochement
  périodique. La transaction rend une écriture atomique, mais n'ordonne pas tous les événements
  concurrents ni leurs lectures Stripe préalables.
- Isoler les caches de données privées par utilisateur/équipe et tester les changements de
  session et d'équipe avec des requêtes en vol.
- Limiter les appels publics à la waitlist et achever les processus de conservation,
  suppression et exercice des droits sur les données personnelles.
