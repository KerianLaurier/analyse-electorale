"use client";

import Link from "next/link";
import {
  Star,
  Building2,
  Map as MapIcon,
  Vote,
  Landmark,
  UserRound,
  Users,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePins, PIN_TYPE_LABELS, type Pin, type PinType } from "@/lib/pins";
import { PinButton } from "@/components/pin-button";

const TYPE_ORDER: PinType[] = ["commune", "circo", "bureau", "elu", "candidat"];

const TYPE_ICON: Record<PinType, typeof Building2> = {
  commune: Building2,
  circo: MapIcon,
  bureau: Vote,
  elu: Landmark,
  candidat: UserRound,
};

export function EspaceView() {
  const pins = usePins();
  const sharedCount = pins.filter((p) => p.shared).length;

  const grouped = TYPE_ORDER.map((type) => ({
    type,
    items: pins.filter((p) => p.type === type),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex-1 bg-canvas">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Espace de travail
        </p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <h1 className="text-[28px] font-semibold tracking-tight">Mes épingles</h1>
          <span className="text-[13px] text-muted-foreground">
            {pins.length} épingle{pins.length > 1 ? "s" : ""}
            {sharedCount > 0 && (
              <>
                {" · "}
                <span className="inline-flex items-center gap-1 text-warm">
                  <Users className="h-3.5 w-3.5" /> {sharedCount} partagée{sharedCount > 1 ? "s" : ""}
                </span>
              </>
            )}
          </span>
        </div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          Vos territoires et personnes suivis, rassemblés. Épinglez depuis n’importe quelle fiche
          (étoile) et partagez-les avec votre équipe.
        </p>

        {pins.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mt-8 flex flex-col gap-8">
            {grouped.map((g) => (
              <section key={g.type}>
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = TYPE_ICON[g.type];
                    return <Icon className="h-4 w-4 text-muted-foreground" />;
                  })()}
                  <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {PIN_TYPE_LABELS[g.type]}s · {g.items.length}
                  </h2>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {g.items.map((p) => (
                    <PinCard key={`${p.type}-${p.id}`} pin={p} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PinCard({ pin }: { pin: Pin }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg border border-black/5 bg-surface p-3.5 shadow-card transition-colors hover:border-warm/40">
      <Link href={pin.href} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate text-[14px] font-medium">
            {pin.label}
            {pin.shared && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-pill bg-warm/15 px-1.5 py-0.5 text-[10px] font-medium text-warm">
                <Users className="h-3 w-3" /> Équipe
              </span>
            )}
          </p>
          {pin.sublabel && (
            <p className="truncate text-[11.5px] text-muted-foreground">{pin.sublabel}</p>
          )}
        </div>
      </Link>
      <PinButton pin={{ type: pin.type, id: pin.id, label: pin.label, sublabel: pin.sublabel, href: pin.href }} />
      <Link
        href={pin.href}
        aria-label="Ouvrir"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground"
      >
        <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-black/10 bg-surface/60 px-6 py-16 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-pill bg-warm/15 text-warm">
        <Star className="h-5 w-5" />
      </span>
      <p className="text-[15px] font-semibold tracking-tight">Aucune épingle pour l’instant</p>
      <p className="max-w-md text-[13px] text-muted-foreground">
        Parcourez une commune, une circonscription, un bureau de vote ou une personne, puis cliquez
        sur l’étoile « Épingler » pour la retrouver ici — et la partager avec votre équipe.
      </p>
      <Link
        href="/explorer"
        className={cn(
          "mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-4 py-2 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90",
        )}
      >
        <MapIcon className="h-4 w-4" /> Explorer la carte
      </Link>
    </div>
  );
}
