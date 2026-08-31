"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import HistoriqueComplet from "@/components/HistoriqueComplet";

export default function RechercheGlobale() {
  const [texte, setTexte] = useState("");
  const [resultats, setResultats] = useState([]);
  const [ouvert, setOuvert] = useState(false);
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const supabase = createClient();

  async function rechercher(valeur) {
    setTexte(valeur);
    if (valeur.trim().length < 2) {
      setResultats([]);
      setOuvert(false);
      return;
    }
    const { data } = await supabase
      .from("dossiers")
      .select("id, nom_dossier, ingenieur, nom_operation, etat")
      .ilike("nom_dossier", `%${valeur.trim()}%`)
      .limit(8);
    setResultats(data || []);
    setOuvert(true);
  }

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="🔍 Rechercher un dossier…"
        value={texte}
        onChange={(e) => rechercher(e.target.value)}
        onFocus={() => texte.length >= 2 && setOuvert(true)}
        onBlur={() => setTimeout(() => setOuvert(false), 150)}
        className="border rounded-md px-3 py-1.5 text-sm w-56"
      />
      {ouvert && (
        <div className="absolute top-full mt-1 left-0 w-72 card p-2 z-30 max-h-72 overflow-y-auto">
          {resultats.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDossierHistorique(d);
                setOuvert(false);
                setTexte("");
              }}
              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-black/5 text-sm"
            >
              <p className="font-medium">{d.nom_dossier}</p>
              <p className="text-xs text-ink/40">{d.ingenieur} · {d.nom_operation} · {d.etat}</p>
            </button>
          ))}
          {resultats.length === 0 && (
            <p className="text-xs text-ink/40 px-2 py-1.5">Aucun résultat.</p>
          )}
        </div>
      )}

      {dossierHistorique && (
        <HistoriqueComplet
          supabase={supabase}
          dossier={dossierHistorique}
          onFermer={() => setDossierHistorique(null)}
        />
      )}
    </div>
  );
}
