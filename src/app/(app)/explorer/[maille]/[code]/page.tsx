import { redirect } from "next/navigation";

export default async function ExplorerSelectionRedirect({
  params,
}: {
  params: Promise<{ maille: string; code: string }>;
}) {
  const { maille, code } = await params;
  const qs = new URLSearchParams({ maille, code });
  redirect(`/explorer?${qs.toString()}`);
}
