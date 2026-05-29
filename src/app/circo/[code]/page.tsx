import { CircoFiche } from "./circo-fiche";

export default async function CirconscriptionPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <CircoFiche code={code} />;
}
