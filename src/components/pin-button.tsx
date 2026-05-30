"use client";

import { Star, Users, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useIsPinned,
  useMyPinScope,
  useMyTeamId,
  togglePin,
  setPinScope,
  type Pin,
  type PinScope,
} from "@/lib/pins";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

type PinInput = Omit<Pin, "addedAt" | "shared" | "mine">;

const BASE =
  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors outline-none";

/** Bouton d'épinglage (persistance serveur). Avec une équipe : menu perso / partagé. */
export function PinButton({ pin, className }: { pin: PinInput; className?: string }) {
  const pinned = useIsPinned(pin.type, pin.id);
  const scope = useMyPinScope(pin.type, pin.id);
  const teamId = useMyTeamId();

  // Sans équipe : simple bascule personnelle.
  if (!teamId) {
    return (
      <button
        type="button"
        onClick={() => togglePin(pin)}
        aria-pressed={pinned}
        title={pinned ? "Retirer des épingles" : "Ajouter aux épingles"}
        className={cn(
          BASE,
          pinned ? "bg-warm/15 text-foreground" : "bg-black/[0.04] text-foreground hover:bg-black/[0.08]",
          className,
        )}
      >
        <Star className={cn("h-3.5 w-3.5", pinned && "fill-warm text-warm")} />
        {pinned ? "Épinglé" : "Épingler"}
      </button>
    );
  }

  // Avec équipe : menu de scope (perso / partagé / retirer).
  const label =
    scope === "team"
      ? "Partagé"
      : scope === "personal"
        ? "Épinglé"
        : pinned
          ? "Épingle équipe"
          : "Épingler";
  const Icon = scope === "team" || (scope === "none" && pinned) ? Users : Star;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        title="Épingler ou partager avec l'équipe"
        className={cn(
          BASE,
          pinned ? "bg-warm/15 text-foreground" : "bg-black/[0.04] text-foreground hover:bg-black/[0.08]",
          className,
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", pinned && scope !== "none" && "fill-warm text-warm")} />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuRadioGroup
          value={scope}
          onValueChange={(v) => void setPinScope(pin, v as PinScope)}
        >
          <DropdownMenuRadioItem value="personal">
            <User className="h-4 w-4" />
            Épingler pour moi
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="team">
            <Users className="h-4 w-4" />
            Partager avec l&apos;équipe
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="none">
            <X className="h-4 w-4" />
            Ne pas épingler
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
