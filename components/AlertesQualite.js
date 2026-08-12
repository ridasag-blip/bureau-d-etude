"use client";
import { SEUIL_ALERTE_JOURS_ENCOURS_VERIF } from "@/lib/constants";

export default function AlertesQualite({ dossiers }) {
  const aRisque = dossiers.filter((d) => d.dossier_a_risque);

  const aujourdHui = new Date();
  const bloques = dossiers.filter((d) => {
    if (!["En attente de vérification", "En cours de vérification"].includes(d.etat)) return false;
    const date = new Date(d.date_soumission || d.date);
    const joursEcoules = (aujourdHui - date) / (1000 * 60 * 60 * 24);
    return joursEcoules > SEUIL_ALERTE_JOURS_ENCOURS_VERIF;
  });

  if (aRisque.length === 0 && bloques.length === 0) return null;

  return (
    <div className="card p-4 border-isoRed/30 bg-isoRed/5">
      <p className="text-xs font-semibold text-isoRed uppercase tracking-wide mb-3">
        Alertes qualité
      </p>
      <div className="flex flex-col gap-2 text-sm">
        {bloques.length > 0 && (
          <p>
            🕒 <strong>{bloques.length}</strong> dossier(s) en attente ou en cours de vérification
            depuis plus de {SEUIL_ALERTE_JOURS_ENCOURS_VERIF} jours.
          </p>
        )}
        {aRisque.length > 0 && (
          <p>
            ⚠️ <strong>{aRisque.length}</strong> dossier(s) à risque (retour interne ET client sur
            le même dossier).
          </p>
        )}
      </div>
    </div>
  );
}
