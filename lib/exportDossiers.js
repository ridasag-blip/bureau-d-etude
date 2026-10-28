import { ETATS, dateDerniereModif } from "@/lib/constants";
import { grouperPassages, regrouperLignes, infoPassages, nomAffiche } from "@/lib/regroupement";

/** Export Excel de dossiers (toutes les colonnes utiles, coordonnées comprises). */
export async function exporterDossiers(dossiers, prefixe = "HILLSOLUTION_dossiers") {
  const XLSX = await import("xlsx");
  const lignes = [...dossiers]
    .sort((a, b) => dateDerniereModif(b).localeCompare(dateDerniereModif(a)))
    .map((d) => ({
      Date: d.date,
      "Dernière modification": dateDerniereModif(d),
      Dossier: d.nom_dossier,
      Statut: ETATS[d.etat]?.court || d.etat,
      "À corriger": d.a_corriger ? "Oui" : "",
      Prioritaire: d.prioritaire ? "Oui" : "",
      Ingénieur: d.ingenieur || "",
      "Ingénieur de modif": d.ingenieur_modif || "",
      "Date de modification": d.date_modification || "",
      "Date retour client": d.date_retour_client || "",
      Fiche: d.nom_operation,
      Client: d.client,
      "Nature production": d.nature_prod,
      Bénéficiaire: d.beneficiaire_nom,
      SIRET: d.beneficiaire_siret,
      Responsable: d.beneficiaire_responsable,
      Adresse: d.beneficiaire_adresse,
      "E-mail": d.beneficiaire_email,
      Téléphone: d.beneficiaire_telephone,
      "Envoyé au contrôle le": d.date_soumission ? new Date(d.date_soumission).toLocaleString("fr-FR") : "",
      "Contrôlé par": d.pris_en_charge_par || "",
      "Audité par": d.valide_par || "",
      "Audité le": d.date_verification ? new Date(d.date_verification).toLocaleString("fr-FR") : "",
      "Nb retours": d.nb_retours || 0,
      "Cause retour interne": d.cause_retour_interne,
      "Cause retour client": d.cause_retour_client,
      Motif: d.motif_statut,
      Commentaire: d.commentaire,
    }));
  // Feuille « Dossiers » : une ligne par dossier (passages regroupés) ; « Détail des passages » : chaque ligne
  const groupes = grouperPassages(dossiers);
  const tries = [...dossiers].sort((a, b) => dateDerniereModif(b).localeCompare(dateDerniereModif(a)));
  const regroupees = regrouperLignes(tries).map((d) => {
    const info = infoPassages(d, groupes);
    return { ...lignes[tries.indexOf(d)], Dossier: nomAffiche(d), "Nb passages": info.n, Versions: info.versions, "Ingénieurs (tous les passages)": [...new Set(info.passages.map((p) => p.ingenieur_modif || p.ingenieur).filter(Boolean))].join(", ") };
  });
  const largeur = (rows) => Object.keys(rows[0] || {}).map((k) => ({ wch: Math.max(10, k.length + 2) }));
  const feuille = XLSX.utils.json_to_sheet(regroupees);
  feuille["!cols"] = largeur(regroupees);
  const detail = XLSX.utils.json_to_sheet(lignes);
  detail["!cols"] = largeur(lignes);
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Dossiers");
  XLSX.utils.book_append_sheet(classeur, detail, "Détail des passages");
  XLSX.writeFile(classeur, `${prefixe}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
