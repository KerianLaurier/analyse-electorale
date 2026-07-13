"use client";

import { useEffect } from "react";
import { wireInstallCapture } from "@/lib/pwa-install";

/**
 * Branche la couche PWA (monté une fois dans le layout racine) :
 * - enregistre le service worker (public/sw.js) — en production uniquement,
 *   le cache fantôme en dev rendrait le HMR incompréhensible ;
 * - capture `beforeinstallprompt` au plus tôt pour les UI d'installation
 *   (menu compte, carte de /bienvenue).
 */
export function Pwa() {
  useEffect(() => {
    wireInstallCapture();
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Enregistrement refusé (navigation privée, quota…) : l'app fonctionne sans.
    });
  }, []);
  return null;
}
