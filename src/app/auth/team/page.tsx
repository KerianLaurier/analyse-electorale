import { PagePlaceholder } from "@/components/page-placeholder";

export default function TeamPage() {
  return (
    <PagePlaceholder
      module="Auth"
      title="Gestion d'équipe"
      description="Invitations, rôles, permissions — base à concevoir avec Supabase RLS."
      bullets={[
        "Rôles : admin, analyste, militant",
        "Invitations par email",
        "Audit log des accès",
      ]}
    />
  );
}
