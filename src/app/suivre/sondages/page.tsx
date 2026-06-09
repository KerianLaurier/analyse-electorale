import { redirect } from "next/navigation";

// Route héritée : les sondages vivent dans la section « Opinion » de Suivre.
export default function SondagesPage() {
  redirect("/suivre?s=opinion");
}
