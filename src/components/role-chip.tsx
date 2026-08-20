import { Badge } from "@appica/ui-react/badge";
import type { TeamRole } from "@/lib/team";
import { cn } from "@/lib/utils";

/**
 * Pastille colorée d'un rôle de campagne — `Badge` d'Appica UI. La couleur
 * vient du rôle lui-même (choisie dans les réglages d'équipe), pas d'une
 * variante : on part de la variante neutre et on peint le fond en ligne.
 */
export function RoleChip({ role, className }: { role: TeamRole; className?: string }) {
  return (
    <Badge
      size="xs"
      variant="soft"
      className={cn("gap-1 rounded-pill text-[10px] text-white", className)}
      style={{ background: role.color }}
    >
      {role.name}
    </Badge>
  );
}

/** Liste de pastilles de rôles, tronquée à `max` (badge « +N »). */
export function RoleChips({ roles, max = 3, className }: { roles: TeamRole[]; max?: number; className?: string }) {
  if (roles.length === 0) return null;
  const shown = roles.slice(0, max);
  const extra = roles.length - shown.length;
  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      {shown.map((r) => (
        <RoleChip key={r.id} role={r} />
      ))}
      {extra > 0 && (
        <Badge size="xs" variant="soft" className="rounded-pill text-[10px] text-muted-foreground">
          +{extra}
        </Badge>
      )}
    </span>
  );
}
