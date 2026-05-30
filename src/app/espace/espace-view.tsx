"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, ListTodo, StickyNote, Star, Users, Megaphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WsContext } from "@/app/espace/types";
import { EspaceOverview } from "@/app/espace/espace-overview";
import { EspaceCampaign } from "@/app/espace/espace-campaign";
import { EspaceTasks } from "@/app/espace/espace-tasks";
import { EspaceNotes } from "@/app/espace/espace-notes";
import { EspacePins } from "@/app/espace/espace-pins";

export type Tab = "overview" | "campaign" | "tasks" | "notes" | "pins";

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Vue d’ensemble", icon: LayoutDashboard },
  { id: "campaign", label: "Campagne", icon: Megaphone },
  { id: "tasks", label: "Actions", icon: ListTodo },
  { id: "notes", label: "Notes", icon: StickyNote },
  { id: "pins", label: "Épingles", icon: Star },
];

export function EspaceView({ ctx }: { ctx: WsContext }) {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">Espace de travail</p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">Quartier général</h1>
          {ctx.teamName ? (
            <span className="inline-flex items-center gap-1 rounded-pill bg-warm/15 px-2.5 py-1 text-[11px] font-semibold text-warm">
              <Users className="h-3.5 w-3.5" /> {ctx.teamName}
            </span>
          ) : (
            <span className="rounded-pill bg-surface-soft px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Espace personnel</span>
          )}
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {ctx.teamName ? (
            <>Préparez le terrain en équipe : actions, notes et territoires suivis, partagés entre membres.</>
          ) : (
            <>
              Organisez votre campagne. Pour collaborer,{" "}
              <Link href="/auth/team" className="font-medium text-warm hover:underline">créez ou rejoignez une équipe</Link>.
            </>
          )}
        </p>

        {/* Onglets */}
        <nav className="mt-6 inline-flex flex-wrap items-center gap-1 rounded-pill bg-surface-soft/70 p-1 text-[13px] shadow-[0_0_0_1px_rgba(10,10,12,0.06)]">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill px-3.5 py-1.5 font-medium transition-all duration-200",
                  active
                    ? "bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(10,10,12,0.18)]"
                    : "text-foreground/70 hover:bg-surface/60 hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            );
          })}
        </nav>

        <div className="mt-7">
          {tab === "overview" && <EspaceOverview ctx={ctx} setTab={setTab} />}
          {tab === "campaign" && <EspaceCampaign />}
          {tab === "tasks" && <EspaceTasks ctx={ctx} />}
          {tab === "notes" && <EspaceNotes ctx={ctx} />}
          {tab === "pins" && <EspacePins />}
        </div>
      </div>
    </div>
  );
}
