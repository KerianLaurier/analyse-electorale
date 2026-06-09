import { redirect } from "next/navigation";

// Route héritée : l'agenda vit dans la section « Échéances » de Suivre.
export default function AgendaPage() {
  redirect("/suivre?s=echeances");
}
