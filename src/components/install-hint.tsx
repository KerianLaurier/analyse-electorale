"use client";

import { useEffect, useState } from "react";
import { MonitorDown, Share } from "lucide-react";
import { Button } from "@appica/ui-react/button";
import {
  canPromptInstall,
  isIosSafari,
  isStandalone,
  onInstallChange,
  promptInstall,
} from "@/lib/pwa-install";

/**
 * Encart d'installation de l'app (affiché sur /bienvenue, parcours découverte).
 * Trois cas : navigateur avec invite native (bouton), iOS Safari (instructions
 * Partager → Sur l'écran d'accueil), sinon rien. Disparaît une fois installée.
 */
export function InstallHint() {
  const [mode, setMode] = useState<"prompt" | "ios" | null>(null);

  useEffect(() => {
    function sync() {
      if (isStandalone()) return setMode(null);
      if (canPromptInstall()) return setMode("prompt");
      if (isIosSafari()) return setMode("ios");
      setMode(null);
    }
    sync();
    return onInstallChange(sync);
  }, []);

  if (!mode) return null;

  return (
    <section className="mt-8 flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-warm/12 text-warm">
          <MonitorDown className="h-[18px] w-[18px]" />
        </span>
        <div>
          <p className="text-[13.5px] font-semibold tracking-tight">Installez MOUVANCIA sur votre écran d&apos;accueil</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            {mode === "prompt" ? (
              <>Lancement en un geste, plein écran, et vos dernières analyses restent consultables hors ligne.</>
            ) : (
              <>
                Sur iPhone/iPad : bouton <Share className="inline h-3.5 w-3.5 align-[-2px]" aria-label="Partager" />{" "}
                Partager, puis « Sur l&apos;écran d&apos;accueil ».
              </>
            )}
          </p>
        </div>
      </div>
      {mode === "prompt" && (
        <Button
          type="button"
          onClick={() => void promptInstall()}
          className="shrink-0 gap-1.5 self-start rounded-pill text-[12.5px] sm:self-center"
        >
          <MonitorDown className="h-3.5 w-3.5" /> Installer
        </Button>
      )}
    </section>
  );
}
