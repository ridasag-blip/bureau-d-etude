import { dateDerniereModif, estRemodifie, formatDate } from "@/lib/constants";

/**
 * Date d'un dossier dans les listes : sa dernière modification (retour, modif client),
 * avec la date de création en info-bulle quand elles diffèrent.
 */
export default function DateDossier({ dossier, court = false }) {
  const derniere = dateDerniereModif(dossier);
  if (!estRemodifie(dossier)) return <span>{formatDate(dossier?.date)}</span>;
  return (
    <span title={`Créé le ${formatDate(dossier.date)} · dernière modification le ${formatDate(derniere)}`}>
      {formatDate(derniere)}
      {!court && <span className="ml-1 text-[11px] font-medium text-isoGold-dark">modifié</span>}
    </span>
  );
}
