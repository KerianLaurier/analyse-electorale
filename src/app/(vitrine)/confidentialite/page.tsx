import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Todo } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Politique de confidentialité — MOUVANCIA",
  description:
    "Traitement des données personnelles dans MOUVANCIA : données collectées, finalités, sous-traitants, durées et droits (RGPD).",
};

// ⚠️ MODÈLE À COMPLÉTER puis À FAIRE VALIDER par un juriste / DPO avant mise en
// ligne. Attention particulière : le service permet d'enregistrer des opinions
// politiques (donnée sensible, art. 9 RGPD) — l'analyse des bases légales et des
// mentions doit être confirmée.

export default function ConfidentialitePage() {
  return (
    <LegalShell title="Politique de confidentialité" updated="21 juillet 2026">
      <p>
        La présente politique décrit comment MOUVANCIA collecte et traite les données personnelles
        de ses utilisateurs, conformément au Règlement général sur la protection des données (RGPD)
        et à la loi Informatique et Libertés.
      </p>

      <h2>Responsable de traitement</h2>
      <p>
        Le responsable de traitement est <Todo>raison sociale de l&apos;éditeur</Todo> (voir les{" "}
        <Link href="/mentions-legales">mentions légales</Link>). Délégué à la protection des données (DPO),
        le cas échéant : <Todo>nom / e-mail du DPO</Todo>.
      </p>

      <h2>Données collectées</h2>
      <ul>
        <li>
          <strong>Compte et équipe</strong> : nom, adresse e-mail professionnelle, organisation,
          mot de passe (stocké de façon chiffrée par le prestataire d&apos;authentification), rôles.
        </li>
        <li>
          <strong>Données de campagne saisies par l&apos;utilisateur</strong> : contacts (nom,
          coordonnées, rôle, commune), <strong>orientation de soutien</strong>{" "}
          (favorable / opposé / indécis), tâches, secteurs de terrain, notes, créneaux, comptes rendus
          de porte-à-porte. L&apos;orientation de soutien constitue une <strong>opinion politique,
          donnée sensible au sens de l&apos;article&nbsp;9 du RGPD</strong>.
        </li>
        <li>
          <strong>Paiement</strong> : la facturation est opérée par Stripe. MOUVANCIA ne collecte ni
          ne stocke les numéros de carte bancaire ; seules des références d&apos;abonnement et de
          client Stripe sont conservées.
        </li>
        <li>
          <strong>Données techniques</strong> : journaux de connexion, données de diagnostic
          d&apos;erreurs, cookies strictement nécessaires au fonctionnement (session, authentification).
        </li>
      </ul>
      <p>
        MOUVANCIA n&apos;exploite <strong>aucune donnée nominative d&apos;électeur</strong> : les
        analyses électorales reposent uniquement sur des agrégats publics (résultats par bureau de
        vote, indicateurs INSEE par commune).
      </p>

      <h2>Finalités et bases légales</h2>
      <ul>
        <li>Fourniture et gestion du service — <strong>exécution du contrat</strong>.</li>
        <li>Facturation et obligations comptables — <strong>obligation légale</strong> / exécution du contrat.</li>
        <li>Sécurité, prévention de la fraude et supervision technique — <strong>intérêt légitime</strong>.</li>
        <li>
          Traitement des <strong>opinions politiques</strong> saisies par l&apos;utilisateur —{" "}
          <strong>consentement explicite</strong> (art.&nbsp;9-2-a) et/ou{" "}
          <Todo>base à confirmer selon l&apos;usage (activité politique, mission d&apos;intérêt public…)</Todo>.
        </li>
      </ul>
      <p>
        L&apos;utilisateur qui enregistre des données relatives à des tiers en est responsable : il
        doit disposer d&apos;une base légale, informer les personnes concernées et respecter leurs
        droits.
      </p>

      <h2>Destinataires et sous-traitants</h2>
      <p>Les données ne sont ni vendues ni cédées. Elles sont accessibles aux membres de l&apos;équipe de l&apos;utilisateur et aux sous-traitants techniques suivants :</p>
      <ul>
        <li><strong>Supabase</strong> — base de données et authentification (hébergement UE).</li>
        <li><strong>Stripe</strong> — traitement des paiements.</li>
        <li><strong>Netlify</strong> — hébergement et diffusion de l&apos;application.</li>
        <li><strong>Sentry</strong> — supervision des erreurs techniques.</li>
        <li><strong>Google Actualités (flux RSS)</strong> — veille presse, sans transmission de données personnelles.</li>
      </ul>
      <p>
        Certains sous-traitants pouvant opérer hors de l&apos;Union européenne, les transferts
        éventuels sont encadrés par des garanties appropriées (clauses contractuelles types de la
        Commission européenne). <Todo>Confirmer la liste et les garanties de chaque sous-traitant</Todo>.
      </p>

      <h2>Durée de conservation</h2>
      <p>
        Les données de compte et de campagne sont conservées tant que le compte est actif, puis
        supprimées ou anonymisées dans un délai de <Todo>durée à définir (ex. 3 mois)</Todo> après la
        résiliation. Les données de facturation sont conservées <Todo>durée légale — ex. 10 ans</Todo>
        {" "}au titre des obligations comptables.
      </p>

      <h2>Vos droits</h2>
      <p>
        Vous disposez des droits d&apos;accès, de rectification, d&apos;effacement, de limitation, de
        portabilité et d&apos;opposition, ainsi que du droit de retirer votre consentement à tout
        moment. Pour les exercer : <Todo>adresse e-mail dédiée</Todo>.
      </p>
      <p>
        Vous pouvez également introduire une réclamation auprès de la Commission nationale de
        l&apos;informatique et des libertés (CNIL), 3 place de Fontenoy, 75007 Paris —{" "}
        <a href="https://www.cnil.fr" rel="noreferrer noopener" target="_blank">www.cnil.fr</a>.
      </p>

      <h2>Cookies</h2>
      <p>
        MOUVANCIA n&apos;utilise que des cookies strictement nécessaires au fonctionnement du service
        (session et authentification), qui ne requièrent pas de consentement préalable. Aucun cookie
        publicitaire ni de mesure d&apos;audience tierce n&apos;est déposé.{" "}
        <Todo>À mettre à jour si un outil de mesure d&apos;audience est ajouté (bandeau de consentement requis)</Todo>.
      </p>
    </LegalShell>
  );
}
