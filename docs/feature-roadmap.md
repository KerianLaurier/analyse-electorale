# Fonctionnalités proposées — MOUVANCIA

État de la recherche : 12 septembre 2026. Les fonctionnalités décrites chez les concurrents proviennent de leur documentation publique ; aucun compte payant n’a été testé. Les priorités ci-dessous sont des propositions produit, pas des fonctionnalités déjà livrées.

## Positionnement recommandé

MOUVANCIA dispose déjà d’un socle différenciant : exploration géographique française, historique électoral et contexte INSEE. La priorité devrait être de rendre chaque analyse compréhensible, vérifiable et partageable. Ajouter un CRM généraliste toujours plus large disperserait l’effort.

Qomon présente déjà un CRM, des imports et des fonctions de cartographie. NationBuilder associe gestion de contacts, permissions et activités. Il faut considérer ces offres comme des références pour les attentes de collaboration, sans supposer qu’une petite équipe peut immédiatement reproduire leur couverture. Sources : [fonctionnalités Qomon](https://fr.qomon.com/fonctionnalites), [guide NationBuilder](https://nationbuilder.com/feature_guide).

Public principal supposé d’après le produit : analystes, responsables d’équipes et cabinets travaillant sur les élections françaises. Les besoins des journalistes et collectivités peuvent constituer un second marché, à valider par entretiens ; je ne le traiterais pas comme acquis.

## Priorités

| Priorité | Fonctionnalité | Utilité concrète | Première version et critère de réussite |
|---|---|---|---|
| P0 | Fiche de provenance de chaque indicateur | Un chiffre devient vérifiable : source, millésime, définition du dénominateur, couverture et date de génération. | Une fiche accessible depuis chaque graphique ; aucune donnée absente présentée comme zéro. |
| P0 | Dossiers d’analyse sauvegardés | Retrouver un territoire, des scrutins et des vues choisis pour une réunion sans recommencer les recherches. | Dossier nommé, version des données figée, notes éditoriales et historique des modifications. |
| P1 | Partage en lecture seule et exports sourcés | Diffuser un diagnostic à une équipe ou à un client avec ses hypothèses et références. | Lien révocable, expiration, permissions vérifiées côté serveur ; PDF/CSV avec source, date et avertissements méthodologiques. Les données personnelles restent exclues par défaut. |
| P1 | Comparaison historique fiable | Comparer deux scrutins sans mélanger des périmètres ou des dénominateurs différents. | Vue côte à côte, absolus/pourcentages, alerte sur changement de limites et explication des rapprochements. |
| P1 | Centre de qualité des données | Repérer une publication manquante, ancienne, partielle ou corrigée. | Catalogue des jeux, couverture, erreurs de contrôle et journal de corrections ; alerte uniquement lorsqu’un changement demande une action. |
| P1 | Calendrier et coordination d’équipe | Réduire les tâches administratives : réunions, formations, disponibilité des membres, responsables et échéances. | Invitations internes, réponse de participation, rappel configurable, export calendrier. Mesurer les tâches effectivement terminées, pas le nombre de notifications envoyées. |
| P1 | Centre de gestion des données personnelles | Donner aux administrateurs les moyens d’exécuter les règles de conservation et les demandes d’accès/effacement. | Inventaire des données, finalité et source, historique d’exports, procédures d’effacement contrôlées. Paramètres définis avec le responsable compétent. |
| P2 | Tableau de résultats officiels actualisé | Suivre une soirée électorale avec un état explicite de complétude et des corrections traçables. | Résultats horodatés, origine identifiable, distinction provisoire/validé, carte et tableau accessibles sur mobile. Dépend d’un flux autorisé et testé. |

Ces rangs expriment mon jugement sur l’utilité et les dépendances. Ils ne constituent pas une estimation de délai ferme.

## Ce que la concurrence éclaire

**Partage et collaboration.** CARTO documente les cartes collaboratives ainsi que différents modes de partage. C’est une référence pertinente pour une application d’analyse, même si CARTO n’est pas un concurrent direct spécialisé dans les campagnes françaises. Pour MOUVANCIA, commencer par un lecteur invité et un lien révocable serait plus utile qu’un éditeur simultané complexe. Sources : [partage et collaboration CARTO](https://docs.carto.com/carto-user-manual/maps/sharing-and-collaboration), [cartes collaboratives](https://docs.carto.com/carto-user-manual/maps/sharing-and-collaboration/collaborative-maps).

**Organisation d’événements.** Qomon documente les événements d’équipe ; NationBuilder décrit inscriptions, calendrier et suivi de présence. La présence de ces parcours chez les deux produits appuie une première version de coordination générale dans MOUVANCIA. Elle ne démontre pas à elle seule que les clients actuels la demandent : vérifier ce besoin auprès de cinq équipes avant de développer davantage. Sources : [événements Qomon](https://help.qomon.com/fr/articles/11594420-creer-une-action-de-type-evenement-dans-qomon), [planification NationBuilder](https://support.nationbuilder.com/en/articles/4377357-event-planning).

**Gestion des données.** NationBuilder documente les exports, les permissions et des outils de confidentialité. L’enjeu pour MOUVANCIA est une procédure exécutable et vérifiable, adaptée aux données réellement détenues. Un simple bouton « conformité » serait trompeur. Sources : [gestion des données NationBuilder](https://support.nationbuilder.com/en/articles/2305580-using-nationbuilder-to-manage-your-data), [outils de confidentialité](https://support.nationbuilder.com/en/articles/2362974-advanced-privacy-tools).

**Résultats publics.** Esri présente des usages cartographiques pour les élections, notamment la publication de résultats. Cette piste peut intéresser les utilisateurs qui ont besoin de comprendre rapidement l’état du dépouillement, sous réserve d’obtenir un flux fiable. Source : [Esri pour les élections](https://www.esri.com/en-us/industries/elections/overview).

## Enchaînement conseillé

1. Finir l’isolation des comptes, les droits en base, les sauvegardes et la fiabilité des publications. Une fonctionnalité de partage dépend directement de ces protections.
2. Livrer provenance et dossiers sauvegardés, puis observer si les utilisateurs les rouvrent pour leur travail réel.
3. Ajouter partage/export avec révocation et journal des accès ; mesurer la compréhension et la facilité de réutilisation des analyses.
4. Choisir entre coordination d’équipe et suivi de résultats à partir d’entretiens et de demandes concrètes.

Je déconseille, à ce stade, de construire un moteur de campagnes SMS/e-mail, de multiplier les intégrations ou d’ajouter des scores individuels d’opinion. Ces axes augmenteraient les coûts opérationnels et les enjeux de données personnelles, sans renforcer directement la fiabilité de l’analyse publique.

Un assistant explicatif peut devenir utile plus tard : réponses limitées aux indicateurs disponibles, références cliquables, calculs reproductibles et possibilité de répondre « données insuffisantes ». Il ne devrait pas inventer des résultats, transformer une corrélation en causalité ou présenter une extrapolation comme une prévision validée.
