"use client";

import * as React from "react";
import { Command as CommandPrimitive } from "cmdk";
import { SearchIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@appica/ui-react/dialog";

/**
 * Palette de commandes (⌘K) — seul écran resté sur `cmdk`.
 *
 * Appica UI couvre le reste de l'interface, mais son `Autocomplete` est un
 * champ ancré à un déclencheur : il ne remplace pas une palette plein écran qui
 * filtre elle-même son index (~2,7 Mo, `shouldFilter={false}`), groupe épinglés
 * / navigation / résultats et navigue au clavier. On garde donc le moteur cmdk
 * et on lui donne l'habillage Appica : la coque est un `Dialog` Appica, les
 * couleurs viennent de son échelle sémantique (`background-*`, `foreground-*`,
 * `border-*`).
 */
function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
  return (
    <CommandPrimitive
      data-slot="command"
      className={cn(
        "flex size-full flex-col overflow-hidden rounded-xl bg-background p-1 text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function CommandDialog({
  title = "Palette de commandes",
  description = "Recherchez un territoire ou une commande.",
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Dialog>, "children"> & {
  title?: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...props}>
      <DialogContent
        // Palette : pas de croix (Échap ferme), pas de cadre verre — le champ
        // et la liste occupent toute la surface.
        closeButton={false}
        frame={false}
        className={cn("overflow-hidden p-0 sm:max-w-2xl", className)}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function CommandInput({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Input>) {
  return (
    <div
      data-slot="command-input-wrapper"
      className="flex items-center gap-2 border-b border-border-muted px-3"
    >
      <SearchIcon className="size-4 shrink-0 text-foreground-subtle" />
      <CommandPrimitive.Input
        data-slot="command-input"
        className={cn(
          "h-11 w-full bg-transparent text-sm text-foreground outline-hidden",
          "placeholder:text-foreground-subtle disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
  return (
    <CommandPrimitive.List
      data-slot="command-list"
      className={cn(
        "max-h-[22rem] scroll-py-1 overflow-x-hidden overflow-y-auto p-1 outline-none",
        className,
      )}
      {...props}
    />
  );
}

function CommandEmpty({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
  return (
    <CommandPrimitive.Empty
      data-slot="command-empty"
      className={cn("py-6 text-center text-sm text-foreground-muted", className)}
      {...props}
    />
  );
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
  return (
    <CommandPrimitive.Group
      data-slot="command-group"
      className={cn(
        "overflow-hidden p-1 text-foreground",
        "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1.5",
        "**:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-medium",
        "**:[[cmdk-group-heading]]:uppercase **:[[cmdk-group-heading]]:tracking-[0.06em]",
        "**:[[cmdk-group-heading]]:text-foreground-subtle",
        className,
      )}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
  return (
    <CommandPrimitive.Separator
      data-slot="command-separator"
      className={cn("-mx-1 h-px bg-border-muted", className)}
      {...props}
    />
  );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
  return (
    <CommandPrimitive.Item
      data-slot="command-item"
      className={cn(
        "relative flex cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden",
        "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
        "data-selected:bg-background-muted data-selected:text-foreground-intense",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className,
      )}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="command-shortcut"
      className={cn("ml-auto text-xs tracking-widest text-foreground-subtle", className)}
      {...props}
    />
  );
}

export {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
};
