"use client";
import { ETAT_COULEURS } from "@/lib/constants";

export default function DossierTable({ dossiers, onOpenDossier }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-ink/50 uppercase bg-black/[0.03]">
            <th className="px-3 py-2 border border-black/10">Date</th>
            <th className="px-3 py-2 border border-black/10">Nom dossier</th>
            <th className="px-3 py-2 border border-black/10">Ingénieur</th>
            <th className="px-3 py-2 border border-black/10">Opération</th>
            <th className="px-3 py-2 border border-black/10">État</th>
            <th className="px-3 py-2 border border-black/10">Retour</th>
            <th className="px-3 py-2 border border-black/10">Validé par</th>
          </tr>
        </thead>
        <tbody>
          {dossiers.map((d) => (
            <tr
              key={d.id}
              className="border border-black/10 hover:bg-black/[0.02] cursor-pointer"
              onClick={() => onOpenDossier?.(d)}
            >
              <td className="px-3 py-2 border border-black/10 whitespace-nowrap">{d.date}</td>
              <td className="px-3 py-2 border border-black/10 font-medium">{d.nom_dossier}</td>
              <td className="px-3 py-2 border border-black/10">{d.ingenieur}</td>
              <td className="px-3 py-2 border border-black/10">{d.nom_operation}</td>
              <td className="px-3 py-2 border border-black/10">
                <span
                  className="badge"
                  style={{
                    background: `${ETAT_COULEURS[d.etat] || "#999"}1A`,
                    color: ETAT_COULEURS[d.etat] || "#333",
                  }}
                >
                  {d.etat}
                </span>
              </td>
              <td className="px-3 py-2 border border-black/10">
                {d.dossier_a_risque ? (
                  <span className="badge bg-isoRed/10 text-isoRed">⚠ Double retour</span>
                ) : d.retour_interne ? (
                  <span className="badge bg-isoGold/10 text-isoGold">Interne</span>
                ) : d.retour_client ? (
                  <span className="badge bg-isoRed/10 text-isoRed">Client</span>
                ) : (
                  <span className="text-ink/30">—</span>
                )}
              </td>
              <td className="px-3 py-2 border border-black/10">{d.valide_par || <span className="text-ink/30">—</span>}</td>
            </tr>
          ))}
          {dossiers.length === 0 && (
            <tr>
              <td colSpan={7} className="px-3 py-8 text-center text-ink/40 border border-black/10">
                Aucun dossier pour ces filtres.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
