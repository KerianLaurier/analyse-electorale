"use client";

import { useSyncExternalStore } from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toasts applicatifs — canal de feedback global (échecs de mutation, infos
 * éphémères). Store module-level réactif (même pattern que les stores Supabase)
 * pour pouvoir être appelé depuis les libs sans passer par le contexte React.
 */

export type ToastTone = "info" | "error" | "success";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  /** Action optionnelle (ex. « Annuler ») affichée à droite du message. */
  action?: { label: string; onClick: () => void };
};

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const EMPTY: Toast[] = [];

function emit() {
  listeners.forEach((l) => l());
}

function dismiss(id: number) {
  const t = timers.get(id);
  if (t) clearTimeout(t);
  timers.delete(id);
  toasts = toasts.filter((x) => x.id !== id);
  emit();
}

function push(message: string, tone: ToastTone, action?: Toast["action"]) {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, message, tone, action }]; // max 3 visibles
  emit();
  // Les erreurs restent plus longtemps : l'utilisateur doit pouvoir les lire.
  timers.set(id, setTimeout(() => dismiss(id), tone === "error" ? 6000 : 4000));
}

export const toast = {
  info: (message: string, action?: Toast["action"]) => push(message, "info", action),
  error: (message: string, action?: Toast["action"]) => push(message, "error", action),
  success: (message: string, action?: Toast["action"]) => push(message, "success", action),
};

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const TONE_ICON = { info: Info, error: AlertCircle, success: CheckCircle2 } as const;
const TONE_CLASS = {
  info: "text-warm",
  error: "text-destructive",
  success: "text-success",
} as const;

export function Toaster() {
  const items = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  if (items.length === 0) return null;

  return (
    <div
      aria-live="polite"
      // Au-dessus de la nav basse mobile (--bottom-nav = 0 en desktop).
      className="pointer-events-none fixed inset-x-0 z-50 flex flex-col items-center gap-2 px-4"
      style={{ bottom: "calc(var(--bottom-nav) + 1rem)" }}
    >
      {items.map((t) => {
        const Icon = TONE_ICON[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className="anim-slide-up pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg bg-surface px-3.5 py-2.5 shadow-floating ring-1 ring-foreground/10"
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", TONE_CLASS[t.tone])} />
            <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-foreground">{t.message}</p>
            {t.action && (
              <button
                type="button"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
                className="shrink-0 rounded px-1.5 py-0.5 text-[12px] font-semibold text-warm hover:bg-warm/10"
              >
                {t.action.label}
              </button>
            )}
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Fermer"
              className="relative grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground hover:text-foreground before:absolute before:-inset-2 before:content-['']"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
