"use client";
import StatutBadge, { Badge } from "@/components/ui/StatutBadge";
import { formatDate, typeDernierRetour } from "@/lib/constants";
import Icon from "@/components/ui/Icon";

export function BadgeRetour({ dossier: d }) {
  if (d.dossier_a_risque) return <Badge ton="red" dot>Double retour</Badge>;
  if (d.retour_interne) return <Badge ton="gold" dot>Interne</Badge>;
  if (d.retour_client) return <Badge ton="red" dot>Client</Badge>;
  return <span className="text-ink/25">—</span>;
}

/** Pastille du type de retour en cours : « Retour interne » ou « Retour client ». */
export function BadgeTypeRetour({ dossier: d, court = false }) {
  if (!d?.a_corriger) return null;
  const client = typeDernierRetour(d) === "client";
  return (
    <span className={`badge ${client ? "badge-red" : "badge-gold"}`} title={client ? "Modification demandée par le client" : "Erreur relevée par la Qualité"}>
      {court ? (client ? "Client" : "Interne") : client ? "Retour client" : "Retour interne"}
    </span>
  );
}

export default function DossierTable({ dossiers, onOpenDossier }) {
  return (
    <div className="card overflow-x-auto">
      <table className="table table-hover">
        <thead>
          <tr>
            <th>Date</th>
            <th>Nom dossier</th>
            <th>Ingénieur</th>
            <th>Opération</th>
            <th>État</th>
            <th>Retour</th>
            <th>Audité par</th>
          </tr>
        </thead>
        <tbody>
          {dossiers.map((d) => (
            <tr key={d.id} className={onOpenDossier ? "cursor-pointer" : ""} onClick={() => onOpenDossier?.(d)}>
              <td className="whitespace-nowrap text-ink/60 tabular">{formatDate(d.date)}</td>
              <td>
                <span className="font-semibold flex items-center gap-1.5">
                  {d.prioritaire && <Icon name="flame" size={13} className="text-isoRed" title="Prioritaire" />}
                  {d.nom_dossier}
                </span>
                {d.beneficiaire_nom && <span className="block text-xs text-ink/50 truncate max-w-[220px]">{d.beneficiaire_nom}</span>}
              </td>
              <td className="capitalize">
                {d.ingenieur || <span className="text-ink/35 normal-case">—</span>}
                {d.hors_habilitation && <span className="block text-[11px] text-isoGold-dark normal-case">hors fiche habituelle</span>}
              </td>
              <td className="text-ink/70">{d.nom_operation}</td>
              <td>
                <StatutBadge etat={d.etat} />
              </td>
              <td>
                <BadgeRetour dossier={d} />
              </td>
              <td className="capitalize">{d.valide_par || <span className="text-ink/25">—</span>}</td>
            </tr>
          ))}
          {dossiers.length === 0 && (
            <tr>
              <td colSpan={7} className="table-empty">Aucun dossier pour ces filtres.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
