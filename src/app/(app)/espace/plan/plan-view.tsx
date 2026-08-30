"use client";

import { useSearchParams } from "next/navigation";
import { Megaphone, MapPin, Star } from "lucide-react";
import { ESPACE, pickVue, type PlanVue } from "@/app/(app)/espace/routes";
import { VueTabs, useWs } from "@/app/(app)/espace/espace-shell";
import { EspaceCampaign } from "@/app/(app)/espace/espace-campaign";
import { EspaceTerritoire } from "@/app/(app)/espace/espace-territoire";
import { EspacePins } from "@/app/(app)/espace/espace-pins";

/**
 * « Le plan » — ce sur quoi la campagne est bâtie : la cible, l'objectif de
 * voix chiffré, le découpage en secteurs, et les territoires suivis.
 *
 * Réunit trois écrans qui parlaient tous du même objet (« où je fais
 * campagne ») et se retrouvaient au même niveau que Notes ou Actions dans
 * l'ancienne barre à dix onglets.
 */

const VUES = [
  { id: "campagne", label: "Campagne", icon: Megaphone },
  { id: "territoire", label: "Territoire", icon: MapPin },
  { id: "epingles", label: "Épingles", icon: Star },
] as const;

const IDS = VUES.map((v) => v.id) as readonly PlanVue[];

export function PlanView() {
  const vue = pickVue(useSearchParams().get("vue"), IDS);
  const ctx = useWs();

  return (
    <>
      <VueTabs vues={VUES} current={vue} href={(v) => ESPACE.plan(v)} />
      {vue === "campagne" && <EspaceCampaign />}
      {vue === "territoire" && <EspaceTerritoire />}
      {vue === "epingles" && <EspacePins />}
      {vue !== "campagne" && ctx.role === "member" && (
        <p className="mt-4 text-[11.5px] text-muted-foreground">
          Les territoires suivis et les épingles sont partagés avec toute l’équipe.
        </p>
      )}
    </>
  );
}
