"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Bouton destructif en deux temps : le premier clic « arme » le bouton
 * (libellé de confirmation), le second exécute. Se désarme après 3 s ou à la
 * perte de focus. Remplace les `confirm()` natifs (non thémés, bloquants) par
 * un geste plus rapide, utilisable au doigt comme au clavier.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmContent = "Confirmer ?",
  className,
  confirmClassName,
  ariaLabel,
}: {
  onConfirm: () => void;
  /** Contenu au repos. */
  children: ReactNode;
  /** Contenu une fois armé. */
  confirmContent?: ReactNode;
  className?: string;
  /** Classes ajoutées (et fusionnées) une fois armé. */
  confirmClassName?: string;
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      aria-label={armed ? undefined : ariaLabel}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
      className={cn(className, armed && confirmClassName)}
    >
      {armed ? confirmContent : children}
    </button>
  );
}
