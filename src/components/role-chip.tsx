import type { TeamRole } from "@/lib/team";
import { cn } from "@/lib/utils";

/** Pastille colorée d'un rôle de campagne. */
export function RoleChip({ role, className }: { role: TeamRole; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 rounded-pill px-1.5 py-0.5 text-[10px] font-medium text-white", className)}
      style={{ background: role.color }}
    >
      {role.name}
    </span>
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
        <span className="inline-flex items-center rounded-pill bg-surface-soft px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          +{extra}
        </span>
      )}
    </span>
  );
}
