"use client";
import { useEffect, useState } from "react";

const LABELS = {
  assignation: "Assigné",
  soumission_verification: "Envoyé pour vérification",
  prise_en_charge: "Pris en charge par la Qualité",
  verification_ok: "Vérifié, Audité",
  retour_interne_avant_audit: "Retour interne",
  retour_interne_apres_audit: "Retour interne (après audit)",
  retour_client: "Retour client (modif. demandée)",
  reassignation: "Réassigné",
};

const COULEURS = {
  assignation: "#1B2A4A",
  soumission_verification: "#FFB800",
  prise_en_charge: "#1B2A4A",
  verification_ok: "#0E8A3E",
  retour_interne_avant_audit: "#FF2D3A",
  retour_interne_apres_audit: "#FF2D3A",
  retour_client: "#FF2D3A",
  reassignation: "#1B2A4A",
};

export default function HistoriqueComplet({ supabase, dossier, onFermer }) {
  const [flux, setFlux] = useState([]);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: evts }, { data: coms }] = await Promise.all([
        supabase.from("dossier_evenements").select("*").eq("dossier_id", dossier.id),
        supabase.from("dossier_commentaires").select("*").eq("dossier_id", dossier.id),
      ]);

      const items = [
        ...(evts || []).map((e) => ({
          type: "evenement",
          key: "e-" + e.id,
          titre: LABELS[e.type] || e.type,
          couleur: COULEURS[e.type] || "#999",
          detail: e.cause,
          auteur: e.effectue_par_nom,
          date: e.created_at,
        })),
        ...(coms || []).map((c) => ({
          type: "commentaire",
          key: "c-" + c.id,
          titre: "Commentaire",
          couleur: "#9AA0A6",
          detail: c.contenu,
          auteur: c.auteur_nom,
          date: c.created_at,
        })),
      ].sort((a, b) => new Date(a.date) - new Date(b.date));

      setFlux(items);
      setChargement(false);
    })();
  }, [dossier.id]);

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40" onClick={onFermer}>
      <div className="card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-display font-semibold text-lg">{dossier.nom_dossier}</h3>
            <p className="text-sm text-ink/50">Parcours complet du dossier</p>
          </div>
          <button onClick={onFermer} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        {chargement ? (
          <p className="text-sm text-ink/40 text-center py-6">Chargement…</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {flux.map((item) => (
              <li key={item.key} className="flex gap-3 text-sm">
                <span
                  className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                  style={{ background: item.couleur }}
                />
                <div>
                  <p className="font-medium">
                    {item.type === "commentaire" ? `💬 ${item.titre}` : item.titre}
                    {item.detail && item.type === "evenement" && (
                      <span className="text-ink/50 font-normal"> — {item.detail}</span>
                    )}
                  </p>
                  {item.type === "commentaire" && (
                    <p className="text-ink/70">{item.detail}</p>
                  )}
                  <p className="text-xs text-ink/40">
                    {new Date(item.date).toLocaleString("fr-FR")}
                    {item.auteur && <> · {item.auteur}</>}
                  </p>
                </div>
              </li>
            ))}
            {flux.length === 0 && (
              <p className="text-sm text-ink/40 text-center py-6">Aucun événement enregistré.</p>
            )}
          </ol>
        )}
      </div>
    </div>
  );
}
