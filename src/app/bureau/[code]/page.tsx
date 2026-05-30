import { BureauFiche } from "./bureau-fiche";

export default async function BureauPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <BureauFiche code={code} />;
}
