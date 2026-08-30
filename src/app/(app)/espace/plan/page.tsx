import { Suspense } from "react";
import { PlanView } from "@/app/(app)/espace/plan/plan-view";
import { TabSkeleton } from "@/components/skeleton";

export default function PlanPage() {
  // Suspense requis : la vue courante est lue dans l'URL (useSearchParams).
  return (
    <Suspense fallback={<TabSkeleton rows={4} />}>
      <PlanView />
    </Suspense>
  );
}
