import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";

type PagePlaceholderProps = {
  module: string;
  title: string;
  description: string;
  bullets?: string[];
  children?: ReactNode;
};

export function PagePlaceholder({
  module,
  title,
  description,
  bullets,
  children,
}: PagePlaceholderProps) {
  return (
    <section className="mx-auto max-w-4xl px-6 py-16">
      <Badge variant="secondary" className="text-xs">
        {module}
      </Badge>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-3 text-muted-foreground">{description}</p>
      {bullets && bullets.length > 0 && (
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      )}
      {children && <div className="mt-8">{children}</div>}
      <p className="mt-10 text-xs text-muted-foreground">
        Page de squelette — implémentation à venir selon la roadmap du brief.
      </p>
    </section>
  );
}
