"use client";

/**
 * Installation PWA — capture de `beforeinstallprompt` (Chrome/Edge/Android)
 * et détection du contexte (déjà installée, iOS Safari sans event).
 *
 * `wireInstallCapture()` doit être appelé TÔT (composant Pwa du layout) :
 * l'événement est émis une seule fois, avant que les vues d'installation ne
 * soient montées. Les composants s'abonnent ensuite via `onInstallChange`.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let wired = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function wireInstallCapture(): void {
  if (wired || typeof window === "undefined") return;
  wired = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // pas de mini-infobar navigateur : l'UI décide du moment
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

/** Le navigateur propose l'installation (Chrome/Edge/Android). */
export function canPromptInstall(): boolean {
  return deferredPrompt !== null;
}

/** Ouvre l'invite native ; true si l'utilisateur accepte. */
export async function promptInstall(): Promise<boolean> {
  const evt = deferredPrompt;
  if (!evt) return false;
  await evt.prompt();
  const { outcome } = await evt.userChoice;
  if (outcome === "accepted") deferredPrompt = null;
  notify();
  return outcome === "accepted";
}

/** L'app tourne déjà en mode installé (fenêtre standalone). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** iOS Safari : pas de `beforeinstallprompt` — l'installation passe par Partager. */
export function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIos = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && navigator.maxTouchPoints > 1);
  return isIos && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export function onInstallChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
