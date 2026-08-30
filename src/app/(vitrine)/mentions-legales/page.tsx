import type { Metadata } from "next";
import Link from "next/link";
import { LegalShell, Todo } from "@/components/legal-shell";

export const metadata: Metadata = {
  title: "Mentions légales — MOUVANCIA",
  description: "Éditeur, hébergement et propriété intellectuelle du service MOUVANCIA.",
};

// ⚠️ MODÈLE À COMPLÉTER puis À FAIRE VALIDER par un juriste avant mise en ligne.
// Les éléments entre crochets (composant <Todo>) doivent être renseignés avec
// les informations réelles de l'éditeur.

export default function MentionsLegalesPage() {
  return (
    <LegalShell title="Mentions légales" updated="21 juillet 2026">
      <h2>Éditeur du site</h2>
      <p>
        Le site et le service MOUVANCIA sont édités par <Todo>raison sociale</Todo>,{" "}
        <Todo>forme juridique (SAS, SARL…)</Todo> au capital de <Todo>montant</Todo> €, immatriculée
        au RCS de <Todo>ville</Todo> sous le numéro <Todo>SIREN / SIRET</Todo>, dont le siège social
        est situé <Todo>adresse complète</Todo>.
      </p>
      <p>
        Numéro de TVA intracommunautaire : <Todo>FR…</Todo>. Contact : <Todo>adresse e-mail</Todo>
        {" "}— <Todo>téléphone (facultatif)</Todo>.
      </p>

      <h2>Directeur de la publication</h2>
      <p><Todo>nom et qualité du directeur de la publication</Todo>.</p>

      <h2>Hébergement du site</h2>
      <p>
        Le site est hébergé par <strong>Netlify, Inc.</strong>, <Todo>adresse de l&apos;hébergeur à
        vérifier</Todo> (États-Unis).
      </p>
      <p>
        Les données personnelles et applicatives sont hébergées au sein de l&apos;Union européenne par{" "}
        <strong>Supabase</strong> (infrastructure Amazon Web Services, région <Todo>UE — ex. Irlande
        (eu-west-1)</Todo>). Voir la <Link href="/confidentialite">politique de confidentialité</Link>.
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        La marque MOUVANCIA, le nom de domaine, la charte graphique, les textes, l&apos;interface et
        le code du service sont la propriété exclusive de l&apos;éditeur ou de ses partenaires. Toute
        reproduction ou représentation, totale ou partielle, sans autorisation écrite préalable est
        interdite.
      </p>
      <p>
        Les données électorales et socio-démographiques exploitées proviennent de sources publiques
        sous licences ouvertes : ministère de l&apos;Intérieur, INSEE et Assemblée nationale.
        Elles restent soumises aux conditions de leurs producteurs respectifs.
      </p>

      <h2>Contact</h2>
      <p>
        Pour toute question relative au site ou au service : <Todo>adresse e-mail de contact</Todo>.
      </p>
    </LegalShell>
  );
}
