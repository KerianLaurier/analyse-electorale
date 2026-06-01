"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Barre de progression globale affichée pendant les navigations (changement de
 * page / d'URL). Démarre dès qu'une navigation commence (hook sur l'History API
 * + `popstate`, ce qui couvre aussi bien les <Link> que les `router.push`) et se
 * termine quand `pathname`/`searchParams` ont changé (= nouvelle page prête).
 *
 * Un délai avant affichage évite tout clignotement sur les navigations
 * instantanées (routes préchargées).
 */
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [width, setWidth] = useState(0);
  const [visible, setVisible] = useState(false);

  const timers = useRef<{ show?: ReturnType<typeof setTimeout>; trickle?: ReturnType<typeof setInterval>; hide?: ReturnType<typeof setTimeout>; safety?: ReturnType<typeof setTimeout> }>({});
  const activeRef = useRef(false);
  const shownRef = useRef(false);

  function clearAll() {
    const t = timers.current;
    if (t.show) clearTimeout(t.show);
    if (t.trickle) clearInterval(t.trickle);
    if (t.hide) clearTimeout(t.hide);
    if (t.safety) clearTimeout(t.safety);
    timers.current = {};
  }

  function start() {
    if (activeRef.current) return;
    activeRef.current = true;
    clearAll();
    // N'afficher qu'au-delà de ~120 ms : les navigations instantanées passent inaperçues.
    timers.current.show = setTimeout(() => {
      shownRef.current = true;
      setVisible(true);
      setWidth(8);
      timers.current.trickle = setInterval(() => {
        setWidth((w) => Math.min(90, w + Math.max(0.4, (90 - w) * 0.06)));
      }, 180);
    }, 120);
    // Garde-fou : si la fin de navigation n'est jamais détectée, on referme.
    timers.current.safety = setTimeout(finish, 10000);
  }

  function finish() {
    if (!activeRef.current) return;
    activeRef.current = false;
    clearAll();
    if (shownRef.current) {
      setWidth(100);
      timers.current.hide = setTimeout(() => {
        setVisible(false);
        setWidth(0);
        shownRef.current = false;
      }, 240);
    }
  }

  // Fin de navigation : l'URL a changé → nouvelle page rendue.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Début de navigation : on décore l'History API + popstate.
  useEffect(() => {
    const origPush = window.history.pushState;
    window.history.pushState = function (this: History, ...args: Parameters<History["pushState"]>) {
      const ret = origPush.apply(this, args);
      start();
      return ret;
    };
    const onPop = () => start();
    window.addEventListener("popstate", onPop);
    return () => {
      window.history.pushState = origPush;
      window.removeEventListener("popstate", onPop);
      clearAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]">
      {visible && (
        <div
          className="h-full rounded-r-full bg-warm shadow-[0_0_8px_rgba(200,116,60,0.7)] transition-[width] duration-200 ease-out"
          style={{ width: `${width}%` }}
        />
      )}
    </div>
  );
}
