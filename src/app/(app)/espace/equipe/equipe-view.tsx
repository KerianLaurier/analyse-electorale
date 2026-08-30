"use client";

import { useSearchParams } from "next/navigation";
import { Users2, Contact, StickyNote } from "lucide-react";
import { ESPACE, pickVue, type EquipeVue } from "@/app/(app)/espace/routes";
import { VueTabs, useWs } from "@/app/(app)/espace/espace-shell";
import { EspaceMembres } from "@/app/(app)/espace/equipe/espace-membres";
import { EspaceContacts } from "@/app/(app)/espace/espace-contacts";
import { EspaceNotes } from "@/app/(app)/espace/espace-notes";

/**
 * « L'équipe » — qui fait quoi, le carnet de contacts et la mémoire partagée.
 *
 * Absorbe la consultation des membres et de leurs rôles de campagne, jusque-là
 * rangée sous `/auth/team` : c'est un réglage produit, pas de l'authentification.
 * La page de réglages reste la seule à porter les actions de gestion.
 */

const VUES = [
  { id: "membres", label: "Membres", icon: Users2 },
  { id: "contacts", label: "Contacts", icon: Contact },
  { id: "notes", label: "Notes", icon: StickyNote },
] as const;

const IDS = VUES.map((v) => v.id) as readonly EquipeVue[];

export function EquipeView() {
  const vue = pickVue(useSearchParams().get("vue"), IDS);
  const ctx = useWs();

  return (
    <>
      <VueTabs vues={VUES} current={vue} href={(v) => ESPACE.equipe(v)} />
      {vue === "membres" && <EspaceMembres />}
      {vue === "contacts" && <EspaceContacts ctx={ctx} />}
      {vue === "notes" && <EspaceNotes ctx={ctx} />}
    </>
  );
}
