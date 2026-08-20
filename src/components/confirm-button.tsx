"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button, type ButtonProps } from "@appica/ui-react/button";
import { cn } from "@/lib/utils";

/**
 * Bouton destructif en deux temps : le premier clic « arme » le bouton
 * (libellé de confirmation), le second exécute. Se désarme après 3 s ou à la
 * perte de focus. Remplace les `confirm()` natifs (non thémés, bloquants) par
 * un geste plus rapide, utilisable au doigt comme au clavier.
 *
 * Bâti sur le `Button` d'Appica UI : au repos il reste discret (`soft`), une
 * fois armé il bascule sur la variante `destructive` — l'escalade visuelle est
 * portée par le système de variantes, plus par des classes ad hoc.
 */
export function ConfirmButton({
  onConfirm,
  children,
  confirmContent = "Confirmer ?",
  className,
  variant = "soft",
  confirmVariant = "destructive",
  size = "sm",
  ariaLabel,
}: {
  onConfirm: () => void;
  /** Contenu au repos. */
  children: ReactNode;
  /** Contenu une fois armé. */
  confirmContent?: ReactNode;
  className?: string;
  /** Variante Appica au repos. */
  variant?: ButtonProps["variant"];
  /** Variante Appica une fois armé. */
  confirmVariant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  ariaLabel?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 3000);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      type="button"
      variant={armed ? confirmVariant : variant}
      size={size}
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
      className={cn("gap-1.5 rounded-pill text-[12px]", className)}
    >
      {armed ? confirmContent : children}
    </Button>
  );
}
