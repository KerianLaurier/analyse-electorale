import { Suspense } from "react";
import { AnalyserView } from "@/app/(app)/analyser/analyser-view";

export default function AnalyserPage() {
  // Suspense requis : le territoire analysé est lu depuis l'URL (useSearchParams).
  return (
    <Suspense fallback={<div className="flex-1 bg-canvas" />}>
      <AnalyserView />
    </Suspense>
  );
}
