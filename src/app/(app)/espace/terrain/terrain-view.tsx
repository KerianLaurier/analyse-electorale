"use client";

import { useSearchParams } from "next/navigation";
import { ListTodo, CalendarClock, DoorOpen, Phone } from "lucide-react";
import { ESPACE, pickVue, type TerrainVue } from "@/app/(app)/espace/routes";
import { VueTabs, useWs } from "@/app/(app)/espace/espace-shell";
import { EspaceTasks } from "@/app/(app)/espace/espace-tasks";
import { EspaceShifts } from "@/app/(app)/espace/espace-shifts";
import { EspaceCanvass } from "@/app/(app)/espace/espace-canvass";
import { EspacePhoning } from "@/app/(app)/espace/espace-phoning";

/**
 * « Le terrain » — l'exécution quotidienne : actions, permanences,
 * porte-à-porte, phoning.
 *
 * C'est la section la plus utilisée, et la seule qui serve vraiment au doigt,
 * dehors. Elle est donc en tête de navigation pour les membres de l'équipe
 * (cf. `sectionsFor` dans espace-shell.tsx).
 */

const VUES = [
  { id: "actions", label: "Actions", icon: ListTodo },
  { id: "permanences", label: "Permanences", icon: CalendarClock },
  { id: "porte-a-porte", label: "Porte-à-porte", icon: DoorOpen },
  { id: "phoning", label: "Phoning", icon: Phone },
] as const;

const IDS = VUES.map((v) => v.id) as readonly TerrainVue[];

export function TerrainView() {
  const vue = pickVue(useSearchParams().get("vue"), IDS);
  const ctx = useWs();

  return (
    <>
      <VueTabs vues={VUES} current={vue} href={(v) => ESPACE.terrain(v)} />
      {vue === "actions" && <EspaceTasks ctx={ctx} />}
      {vue === "permanences" && <EspaceShifts ctx={ctx} />}
      {vue === "porte-a-porte" && <EspaceCanvass />}
      {vue === "phoning" && <EspacePhoning />}
    </>
  );
}
