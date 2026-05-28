import { Suspense } from "react";
import { ExplorerView } from "@/app/explorer/explorer-view";

export default function ExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Chargement de l&apos;explorateur…
        </div>
      }
    >
      <ExplorerView />
    </Suspense>
  );
}
