"use client";

import { AlertTriangle, RotateCw } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bloc d'erreur de chargement avec action « Réessayer » optionnelle. */
export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50/60 px-6 py-10 text-center",
        className,
      )}
    >
      <span className="grid h-10 w-10 place-items-center rounded-pill bg-red-100 text-red-600">
        <AlertTriangle className="h-5 w-5" />
      </span>
      <p className="text-[13px] font-medium text-foreground">
        {message ?? "Une erreur est survenue lors du chargement."}
      </p>
      <p className="max-w-sm text-[12px] text-muted-foreground">
        Vérifiez votre connexion puis réessayez. Si le problème persiste, les données sont peut-être momentanément indisponibles.
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-1 inline-flex items-center gap-1.5 rounded-pill bg-primary px-3.5 py-1.5 text-[12.5px] font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <RotateCw className="h-3.5 w-3.5" /> Réessayer
        </button>
      )}
    </div>
  );
}
