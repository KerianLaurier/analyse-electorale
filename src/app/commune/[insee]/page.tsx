import { CommuneFiche } from "./commune-fiche";

export default async function CommunePage({
  params,
}: {
  params: Promise<{ insee: string }>;
}) {
  const { insee } = await params;
  return <CommuneFiche insee={insee} />;
}
