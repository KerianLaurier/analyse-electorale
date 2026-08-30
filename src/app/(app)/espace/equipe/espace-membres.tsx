"use client";

import Link from "next/link";
import { ArrowRight, Crown, UserPlus, Users2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { memberInitials } from "@/app/(app)/espace/types";
import { useWs } from "@/app/(app)/espace/espace-shell";
import { RoleChips } from "@/components/role-chip";

/**
 * Membres de l'équipe et rôles de campagne.
 *
 * Vue de consultation : la gestion (invitations, création de rôles,
 * affectations) reste sur `/auth/team`, qui reste la page de réglages du
 * compte. Le lien n'est proposé qu'au responsable — c'est lui qui dispose des
 * actions là-bas.
 */
export function EspaceMembres() {
  const ctx = useWs();

  if (ctx.isSolo) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-foreground/10 bg-surface/60 px-6 py-16 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-pill bg-warm/15 text-warm">
          <UserPlus className="h-5 w-5" />
        </span>
        <p className="text-[15px] font-semibold tracking-tight">Vous travaillez seul·e</p>
        <p className="max-w-md text-[13px] text-muted-foreground">
          Créez une équipe pour partager le plan, le terrain et les contacts. Chaque membre retrouve
          alors le même QG, mis à jour en temps réel.
        </p>
        <Link
          href="/auth/team"
          className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          Créer ou rejoindre une équipe <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    );
  }

  return (
    <section className="rounded-lg border border-foreground/5 bg-surface p-4 shadow-card">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Users2 className="h-3.5 w-3.5" /> {ctx.members.length} membre{ctx.members.length > 1 ? "s" : ""}
        </h2>
        {ctx.role === "owner" && (
          <Link href="/auth/team" className="inline-flex items-center gap-1 text-[11.5px] font-medium text-warm hover:underline">
            Inviter, gérer les rôles <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <ul className="flex flex-col divide-y divide-border/60">
        {ctx.members.map((m) => (
          <li key={m.id} className="flex items-center gap-2 py-2.5 text-[12.5px]">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-pill bg-surface-soft text-[9.5px] font-semibold text-foreground/70">
              {memberInitials(m.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 truncate font-medium">
                {m.name}
                {m.id === ctx.meId && <span className="font-normal text-muted-foreground">(moi)</span>}
              </span>
              {m.email && <span className="block truncate text-[11px] text-muted-foreground">{m.email}</span>}
            </span>
            {m.roles.length > 0 ? (
              <RoleChips roles={m.roles} max={4} />
            ) : (
              <span className={cn("shrink-0 text-[11px] text-muted-foreground")}>Aucun rôle</span>
            )}
          </li>
        ))}
      </ul>
      {ctx.role === "owner" && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Crown className="h-3 w-3 text-warm" /> Vous êtes responsable : vous seul·e définissez la cible,
          l’objectif de voix et le découpage en secteurs.
        </p>
      )}
    </section>
  );
}
