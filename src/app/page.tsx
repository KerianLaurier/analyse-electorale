import Link from "next/link";
import { ArrowRight, BarChart3, Map as MapIcon, Activity } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function HomePage() {
  return (
    <div className="flex-1">
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16">
        <p className="text-sm font-medium text-muted-foreground">
          Présidentielle et législatives 2027
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
          Comprendre le territoire électoral, jusqu&apos;au bureau de vote.
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Cartographie, historique de scrutins, sondages, simulateurs et analyse de marginalité.
          Données ouvertes, requêtes instantanées, exports professionnels.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/explorer" className={buttonVariants({ size: "lg" })}>
            Ouvrir l&apos;explorateur
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
          <Link
            href="/suivre/sondages"
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            Voir les sondages
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 pb-24 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <MapIcon className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="mt-2 text-lg">Explorer</CardTitle>
            <CardDescription>
              Carte interactive jusqu&apos;au bureau de vote, sociologie INSEE, drill-down complet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm font-medium hover:underline" href="/explorer">
              Lancer →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <BarChart3 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="mt-2 text-lg">Analyser</CardTitle>
            <CardDescription>
              Comparateurs, simulateur législatif, score de marginalité, territoires-pivots.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm font-medium hover:underline" href="/analyser/simulateur">
              Simuler →
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Activity className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="mt-2 text-lg">Suivre</CardTitle>
            <CardDescription>
              Sondages agrégés, parrainages, agenda électoral, soirée temps réel.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link className="text-sm font-medium hover:underline" href="/suivre/sondages">
              Suivre →
            </Link>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
