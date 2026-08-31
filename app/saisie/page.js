"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DossierFormSaisie from "@/components/DossierFormSaisie";
import DossierTable from "@/components/DossierTable";
import CommentThread from "@/components/CommentThread";
import HistoriqueDossier from "@/components/HistoriqueDossier";
import ObjectifJour from "@/components/ObjectifJour";
import SelectionPersonne from "@/components/SelectionPersonne";
import { useAppData } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import { chargeParIngenieur as calculerCharge } from "@/lib/scoring";

export default function SaisiePage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;
  const nomTrace = estAdmin ? null : nomActif;
  const [dossiers, setDossiers] = useState([]);
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [commentaires, setCommentaires] = useState([]);
  const [evenements, setEvenements] = useState([]);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);

  async function chargerDossiers() {
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setDossiers(data || []);
  }

  useEffect(() => {
    if (profile) chargerDossiers();
  }, [profile]);

  async function ouvrirDossier(d) {
    setDossierOuvert(d);
    const [{ data: coms }, { data: evts }] = await Promise.all([
      supabase.from("dossier_commentaires").select("*").eq("dossier_id", d.id).order("created_at", { ascending: true }),
      supabase.from("dossier_evenements").select("*").eq("dossier_id", d.id).order("created_at", { ascending: true }),
    ]);
    setCommentaires(coms || []);
    setEvenements(evts || []);
  }

  async function ajouterCommentaire(texte) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("dossier_commentaires").insert({
      dossier_id: dossierOuvert.id,
      auteur_id: user.id,
      auteur_nom: nomTrace,
      contenu: texte,
    });
    ouvrirDossier(dossierOuvert);
  }

  async function soumettreDossier(form) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      ...form,
      etat: "En attente de traitement",
      created_by: user.id,
    };

    const { data, error } = await supabase.from("dossiers").insert(payload).select().single();
    if (error) {
      alert("Erreur à l'enregistrement : " + error.message);
      return;
    }

    await supabase.from("dossier_evenements").insert({
      dossier_id: data.id,
      type: "assignation",
      effectue_par: user.id,
      effectue_par_nom: nomTrace,
    });

    chargerDossiers();
    setFormulaireOuvert(false);
  }

  if (erreurProfil) {
    return (
      <div className="p-10 max-w-lg mx-auto text-center">
        <p className="text-isoRed font-medium mb-2">Profil introuvable</p>
        <p className="text-sm text-ink/60">{erreurProfil}</p>
      </div>
    );
  }
  if (loading || !profile) return <div className="p-10 text-center text-ink/40">Chargement…</div>;
  if (!estAdmin && !pretPersonne) return <div className="p-10 text-center text-ink/40">Chargement…</div>;

  if (!estAdmin && !nomActif) {
    return <SelectionPersonne personnes={validateurs} onSelection={selectionner} />;
  }

  const charge = calculerCharge(dossiers);

  return (
    <div>
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-4">Saisie</h1>

        <ObjectifJour supabase={supabase} operations={options.operations} />

        <div className="flex justify-between items-center mb-4">
          <h2 className="font-display text-lg font-semibold">Dernières saisies</h2>
          <button onClick={() => setFormulaireOuvert(true)} className="btn-primary text-sm">
            Nouveau
          </button>
        </div>

        <DossierTable dossiers={dossiers} onOpenDossier={ouvrirDossier} />
      </main>

      {formulaireOuvert && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-6" onClick={() => setFormulaireOuvert(false)}>
          <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setFormulaireOuvert(false)}
                className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-ink/50 hover:text-ink"
              >
                ✕
              </button>
            </div>
            <DossierFormSaisie
              options={options}
              dossiersExistants={dossiers}
              chargeParIngenieur={charge}
              onSubmit={soumettreDossier}
              roleActuel={profile.role}
              ingenieurConnecte={profile.ingenieur_ref}
            />
          </div>
        </div>
      )}

      {dossierOuvert && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30" onClick={() => setDossierOuvert(null)}>
          <div className="card p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-display font-semibold text-lg">{dossierOuvert.nom_dossier}</h3>
                <p className="text-sm text-ink/50">{dossierOuvert.ingenieur} · {dossierOuvert.nom_operation}</p>
              </div>
              <button onClick={() => setDossierOuvert(null)} className="text-ink/40 hover:text-ink">✕</button>
            </div>

            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">Historique</p>
            <HistoriqueDossier evenements={evenements} />

            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2 mt-6">Commentaires</p>
            <CommentThread
              commentaires={commentaires}
              onAjouter={ajouterCommentaire}
              auteurNom={nomActif}
            />
          </div>
        </div>
      )}
    </div>
  );
}
