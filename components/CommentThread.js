"use client";
import { useState } from "react";

export default function CommentThread({ commentaires, onAjouter, auteurNom }) {
  const [texte, setTexte] = useState("");
  const [envoi, setEnvoi] = useState(false);

  async function envoyer() {
    if (!texte.trim()) return;
    setEnvoi(true);
    try {
      await onAjouter(texte.trim());
      setTexte("");
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3 max-h-64 overflow-y-auto">
        {commentaires.map((c) => (
          <li key={c.id} className="text-sm">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{c.auteur_nom}</span>
              <span className="text-xs text-ink/40">
                {new Date(c.created_at).toLocaleString("fr-FR")}
              </span>
            </div>
            <p className="text-ink/80">{c.contenu}</p>
          </li>
        ))}
        {commentaires.length === 0 && (
          <li className="text-sm text-ink/40">Aucun commentaire pour le moment.</li>
        )}
      </ul>
      <div className="flex gap-2">
        <input
          className="border rounded-md px-2 py-1.5 text-sm flex-1"
          placeholder={`Écrire en tant que ${auteurNom}…`}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && envoyer()}
        />
        <button className="btn-primary !py-1.5" onClick={envoyer} disabled={envoi}>
          Envoyer
        </button>
      </div>
    </div>
  );
}
