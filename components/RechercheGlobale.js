"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabaseClient";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import StatutBadge from "@/components/ui/StatutBadge";
import Icon from "@/components/ui/Icon";

export default function RechercheGlobale({ pleineLargeur = false }) {
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
      <div className="relative">
        <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none" />
        <input
          type="search"
          placeholder="Rechercher un dossier…"
          value={texte}
          onChange={(e) => rechercher(e.target.value)}
          onFocus={() => texte.length >= 2 && setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          className={`input pl-9 bg-paper border-transparent hover:border-line focus:bg-white ${
            pleineLargeur ? "w-full" : "w-48 2xl:w-60"
          }`}
        />
      </div>
      {ouvert && (
        <div className="absolute top-full mt-2 right-0 w-80 max-w-[92vw] bg-white rounded-xl border border-line shadow-pop p-1.5 z-40 max-h-80 overflow-y-auto animate-slide-up">
          {resultats.map((d) => (
            <button
              key={d.id}
              onClick={() => {
                setDossierHistorique(d);
                setOuvert(false);
                setTexte("");
              }}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-brand-50/60 flex items-center justify-between gap-3"
            >
              <span className="min-w-0">
                <span className="block text-sm font-semibold truncate">{d.nom_dossier}</span>
                <span className="block text-xs text-ink/45 truncate">
                  {d.ingenieur} · {d.nom_operation}
                </span>
              </span>
              <StatutBadge etat={d.etat} />
            </button>
          ))}
          {resultats.length === 0 && <p className="text-sm text-ink/45 px-3 py-3">Aucun dossier trouvé.</p>}
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
