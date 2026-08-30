import { Suspense } from "react";
import { TerrainView } from "@/app/(app)/espace/terrain/terrain-view";
import { TabSkeleton } from "@/components/skeleton";

export default function TerrainPage() {
  // Suspense requis : la vue courante est lue dans l'URL (useSearchParams).
  return (
    <Suspense fallback={<TabSkeleton rows={4} />}>
      <TerrainView />
    </Suspense>
  );
}
