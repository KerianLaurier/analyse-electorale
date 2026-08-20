"use client";

import { Star, Users, User, X } from "lucide-react";
import { Button, buttonVariants } from "@appica/ui-react/button";
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
} from "@appica/ui-react/dropdown-menu";

type PinInput = Omit<Pin, "addedAt" | "shared" | "mine">;

// Gabarit commun aux deux formes du bouton (bascule simple / déclencheur de
// menu) : la pilule est portée ici, l'état épinglé colore le fond.
const BASE = "gap-1.5 rounded-pill text-[12px]";
const tone = (pinned: boolean) => (pinned ? "bg-warm/15 text-foreground" : undefined);

/** Bouton d'épinglage (persistance serveur). Avec une équipe : menu perso / partagé. */
export function PinButton({ pin, className }: { pin: PinInput; className?: string }) {
  const pinned = useIsPinned(pin.type, pin.id);
  const scope = useMyPinScope(pin.type, pin.id);
  const teamId = useMyTeamId();

  // Sans équipe : simple bascule personnelle.
  if (!teamId) {
    return (
      <Button
        type="button"
        variant="soft"
        size="sm"
        onClick={() => togglePin(pin)}
        aria-pressed={pinned}
        title={pinned ? "Retirer des épingles" : "Ajouter aux épingles"}
        className={cn(BASE, tone(pinned), className)}
      >
        <Star className={cn("h-3.5 w-3.5", pinned && "fill-warm text-warm")} />
        {pinned ? "Épinglé" : "Épingler"}
      </Button>
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
      {/* Le déclencheur du menu doit ressembler au bouton simple : on lui
          applique les mêmes classes de variante, générées par `buttonVariants`. */}
      <DropdownMenuTrigger
        title="Épingler ou partager avec l'équipe"
        className={cn(
          buttonVariants({ variant: "soft", size: "sm" }),
          BASE,
          tone(pinned),
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
