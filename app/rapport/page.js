import { redirect } from "next/navigation";

// La page Rapport (PDF) a été supprimée.
// Ce fichier remplace l'ancien pour qu'un simple upload suffise, sans suppression manuelle.
export default function RapportPage() {
  redirect("/saisie");
}
