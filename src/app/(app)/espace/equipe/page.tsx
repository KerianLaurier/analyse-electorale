import { Suspense } from "react";
import { EquipeView } from "@/app/(app)/espace/equipe/equipe-view";
import { TabSkeleton } from "@/components/skeleton";

export default function EquipePage() {
  // Suspense requis : la vue courante est lue dans l'URL (useSearchParams).
  return (
    <Suspense fallback={<TabSkeleton rows={4} />}>
      <EquipeView />
    </Suspense>
  );
}
