import { Suspense } from "react";
import { CiblageView } from "@/app/analyser/ciblage/ciblage-view";

export default function CiblagePage() {
  return (
    <Suspense fallback={<div className="min-h-[60dvh] bg-canvas" />}>
      <CiblageView />
    </Suspense>
  );
}
