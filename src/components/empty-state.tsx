import type { ReactNode } from "react";
import Link from "next/link";
import { Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * État vide encadré (titre + description + action facultative vers la carte).
 * Source unique du style « aucune donnée » des fiches territoire.
 */
export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: { href: string; label: string };
  className?: string;
}) {
  return (
    <div className={cn("mt-10 rounded-2xl border border-foreground/5 bg-surface/60 p-8 text-center", className)}>
      <p className="text-[13px] font-medium">{title}</p>
      {description && <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <MapIcon className="h-3.5 w-3.5" />
          {action.label}
        </Link>
      )}
    </div>
  );
}
