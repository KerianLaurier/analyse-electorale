import { Suspense } from "react";
import { SuivreView } from "@/app/suivre/suivre-view";

export default function SuivrePage() {
  // Suspense requis : la section active est lue depuis l'URL (useSearchParams).
  return (
    <Suspense fallback={null}>
      <SuivreView />
    </Suspense>
  );
}
