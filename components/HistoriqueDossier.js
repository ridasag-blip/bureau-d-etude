"use client";

const LABELS = {
  assignation: { texte: "Assigné", couleur: "#1B2A4A" },
  verification_ok: { texte: "Vérifié, Audité", couleur: "#0E8A3E" },
  retour_interne_avant_audit: { texte: "Retour interne (avant audit)", couleur: "#D4A017" },
  retour_interne_apres_audit: { texte: "Retour interne (après audit)", couleur: "#C7070A" },
  retour_client: { texte: "Retour client (modif. demandée)", couleur: "#C7070A" },
  reassignation: { texte: "Réassigné", couleur: "#1B2A4A" },
};

export default function HistoriqueDossier({ evenements }) {
  if (!evenements || evenements.length === 0) {
    return <p className="text-sm text-ink/40">Aucun événement enregistré.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {evenements.map((e) => {
        const label = LABELS[e.type] || { texte: e.type, couleur: "#999" };
        return (
          <li key={e.id} className="flex gap-3 text-sm">
            <span
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ background: label.couleur }}
            />
            <div>
              <p className="font-medium">
                {label.texte}
                {e.cause && <span className="text-ink/50 font-normal"> — {e.cause}</span>}
              </p>
              <p className="text-xs text-ink/40">
                {new Date(e.created_at).toLocaleString("fr-FR")}
                {e.effectue_par_nom && <> · {e.effectue_par_nom}</>}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
