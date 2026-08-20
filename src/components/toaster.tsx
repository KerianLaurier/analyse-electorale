"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import {
  createToastManager,
  ToastProvider,
  Toaster as AppicaToaster,
} from "@appica/ui-react/toast";

/**
 * Toasts applicatifs — canal de feedback global (échecs de mutation, infos
 * éphémères), servi par le `Toast` d'Appica UI.
 *
 * Le store maison (module-level + `useSyncExternalStore`) existait pour une
 * seule raison : pouvoir déclencher un toast depuis `src/lib/*`, hors arbre
 * React. `createToastManager()` couvre exactement ce besoin — le gestionnaire
 * vit au niveau module, la file, les minuteurs, l'empilement, le balayage pour
 * fermer et les annonces ARIA viennent du composant.
 */

const manager = createToastManager();

const TONE = {
  info: { icon: <Info className="h-4 w-4" />, timeout: 4000 },
  success: { icon: <CheckCircle2 className="h-4 w-4" />, timeout: 4000 },
  // Les erreurs restent plus longtemps : l'utilisateur doit pouvoir les lire.
  error: { icon: <AlertCircle className="h-4 w-4" />, timeout: 6000 },
} as const;

export type ToastTone = keyof typeof TONE;

type ToastAction = { label: string; onClick: () => void };

function push(message: string, tone: ToastTone, action?: ToastAction) {
  const { icon, timeout } = TONE[tone];
  manager.add({
    title: message,
    // `type` pilote la couleur de l'icône et le rôle ARIA côté Appica.
    type: tone,
    timeout,
    priority: tone === "error" ? "high" : "low",
    data: { icon },
    ...(action
      ? { actionProps: { children: action.label, onClick: action.onClick } }
      : {}),
  });
}

export const toast = {
  info: (message: string, action?: ToastAction) => push(message, "info", action),
  error: (message: string, action?: ToastAction) => push(message, "error", action),
  success: (message: string, action?: ToastAction) => push(message, "success", action),
};

export function Toaster() {
  return (
    <ToastProvider toastManager={manager} timeout={4000} limit={3}>
      {/* Remonté au-dessus de la nav basse mobile (--bottom-nav vaut 0 en desktop). */}
      <AppicaToaster
        position="bottom-center"
        progress
        className="bottom-[calc(var(--bottom-nav)+1rem)]"
      />
    </ToastProvider>
  );
}
