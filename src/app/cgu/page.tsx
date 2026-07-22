import type { Metadata } from "next";
import { LegalShell, Todo } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Conditions générales — MOUVANCIA",
  description:
    "Conditions générales d'utilisation et d'abonnement au service MOUVANCIA : compte, essai, facturation, responsabilités.",
};

// ⚠️ MODÈLE À COMPLÉTER puis À FAIRE VALIDER par un juriste avant mise en ligne.
// Les clauses d'abonnement, de rétractation et de responsabilité doivent être
// adaptées au statut réel des clients (professionnels / consommateurs).

export default function CguPage() {
  return (
    <LegalShell title="Conditions générales d'utilisation et d'abonnement" updated="21 juillet 2026">
      <h2>1. Objet</h2>
      <p>
        Les présentes conditions régissent l&apos;accès et l&apos;utilisation du service MOUVANCIA,
        outil d&apos;analyse électorale et de pilotage de campagne. Elles sont éditées par{" "}
        <Todo>raison sociale</Todo> (voir <a href="/mentions-legales">mentions légales</a>). Toute
        utilisation du service emporte acceptation pleine et entière des présentes conditions.
      </p>

      <h2>2. Compte</h2>
      <p>
        L&apos;accès au service requiert la création d&apos;un compte. L&apos;utilisateur garantit
        l&apos;exactitude des informations fournies, préserve la confidentialité de ses identifiants
        et est responsable des actions effectuées depuis son compte. Le service est destiné à un
        usage professionnel dans le cadre d&apos;une équipe de campagne.
      </p>

      <h2>3. Essai gratuit et abonnement</h2>
      <ul>
        <li>Un essai gratuit de 14 jours, sans carte bancaire, est proposé lors de l&apos;inscription.</li>
        <li>
          À l&apos;issue de l&apos;essai, l&apos;accès complet requiert un abonnement payant selon les
          formules en vigueur. La facturation et les paiements sont assurés par Stripe.
        </li>
        <li>
          L&apos;abonnement est reconduit automatiquement à chaque échéance (mensuelle ou annuelle)
          jusqu&apos;à résiliation par l&apos;utilisateur depuis son espace de facturation.
        </li>
        <li>
          La résiliation prend effet à la fin de la période en cours ; l&apos;accès est maintenu
          jusqu&apos;à cette échéance. <Todo>Politique de remboursement / proratisation à préciser</Todo>.
        </li>
        <li>
          <Todo>Droit de rétractation à préciser selon le statut du client (professionnel ou consommateur)</Todo>.
        </li>
      </ul>

      <h2>4. Utilisation conforme</h2>
      <p>
        L&apos;utilisateur s&apos;engage à utiliser le service dans le respect des lois en vigueur et
        des présentes conditions. Il est notamment responsable des données qu&apos;il saisit et du
        respect du RGPD à l&apos;égard des personnes concernées (voir la{" "}
        <a href="/confidentialite">politique de confidentialité</a>). Toute tentative d&apos;atteinte
        à la sécurité ou à l&apos;intégrité du service est interdite.
      </p>

      <h2>5. Données et analyses</h2>
      <p>
        Les analyses reposent sur des données publiques agrégées (ministère de l&apos;Intérieur,
        INSEE, Assemblée nationale, Commission des sondages). Elles sont fournies à titre indicatif :
        une corrélation statistique ne vaut pas causalité, et les projections ne constituent pas une
        garantie de résultat. Les décisions de campagne relèvent de la seule responsabilité de
        l&apos;utilisateur.
      </p>

      <h2>6. Disponibilité</h2>
      <p>
        L&apos;éditeur met en œuvre les moyens raisonnables pour assurer la disponibilité du service,
        sans garantie d&apos;absence d&apos;interruption. Des opérations de maintenance peuvent
        entraîner une indisponibilité temporaire.
      </p>

      <h2>7. Responsabilité</h2>
      <p>
        La responsabilité de l&apos;éditeur ne saurait être engagée pour les dommages indirects, ni
        pour l&apos;usage fait des analyses ou des données par l&apos;utilisateur.{" "}
        <Todo>Clause de limitation de responsabilité à faire valider (plafond, exclusions)</Todo>.
      </p>

      <h2>8. Propriété intellectuelle</h2>
      <p>
        Le service, sa marque et ses contenus sont protégés. L&apos;abonnement confère un droit
        d&apos;usage personnel et non exclusif, sans transfert de propriété.
      </p>

      <h2>9. Modification des conditions</h2>
      <p>
        L&apos;éditeur peut faire évoluer les présentes conditions. Les utilisateurs sont informés des
        modifications substantielles ; la poursuite de l&apos;utilisation vaut acceptation de la
        version en vigueur.
      </p>

      <h2>10. Droit applicable et litiges</h2>
      <p>
        Les présentes conditions sont soumises au droit français. À défaut de résolution amiable,
        tout litige relève des tribunaux compétents de <Todo>ressort à préciser</Todo>. Conformément
        à la réglementation, l&apos;utilisateur consommateur peut recourir à un médiateur de la
        consommation : <Todo>coordonnées du médiateur, le cas échéant</Todo>.
      </p>
    </LegalShell>
  );
}
