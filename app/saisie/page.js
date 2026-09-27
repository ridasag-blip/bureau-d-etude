"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DossierFormSaisie from "@/components/DossierFormSaisie";
import DossierTable from "@/components/DossierTable";
import CommentThread from "@/components/CommentThread";
import HistoriqueDossier from "@/components/HistoriqueDossier";
import ObjectifJour from "@/components/ObjectifJour";
import PageHeader, { SectionTitle } from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import StatutBadge from "@/components/ui/StatutBadge";
import { gardePage } from "@/components/ui/Screens";
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

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner });
  if (ecran) return ecran;

  const charge = calculerCharge(dossiers);

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="pencil"
          titre="Saisie"
          sousTitre="Dispatching des dossiers vers les ingénieurs."
          actions={
            <button onClick={() => setFormulaireOuvert(true)} className="btn-primary">
              <Icon name="plus" size={16} />
              Nouveau dossier
            </button>
          }
        />

        <ObjectifJour supabase={supabase} operations={options.operations} />

        <SectionTitle
          icone="list"
          titre="Dernières saisies"
          compteur={dossiers.length}
          actions={<span className="text-xs text-ink/45">Clique sur une ligne pour voir l'historique et les commentaires</span>}
        />
        <DossierTable dossiers={dossiers} onOpenDossier={ouvrirDossier} />
      </main>

      {formulaireOuvert && (
        <Modal titre="Nouveau dossier" sousTitre="Saisie — dispatching" onFermer={() => setFormulaireOuvert(false)} taille="lg">
          <DossierFormSaisie
            options={options}
            dossiersExistants={dossiers}
            chargeParIngenieur={charge}
            onSubmit={soumettreDossier}
            roleActuel={profile.role}
            ingenieurConnecte={profile.ingenieur_ref}
            onAnnuler={() => setFormulaireOuvert(false)}
          />
        </Modal>
      )}

      {dossierOuvert && (
        <Modal
          titre={dossierOuvert.nom_dossier}
          sousTitre={`${dossierOuvert.ingenieur || "—"} · ${dossierOuvert.nom_operation || "—"}`}
          onFermer={() => setDossierOuvert(null)}
        >
          <div className="mb-5">
            <StatutBadge etat={dossierOuvert.etat} complet />
          </div>
          <p className="eyebrow mb-3">Historique</p>
          <HistoriqueDossier evenements={evenements} />

          <p className="eyebrow mb-3 mt-6">Commentaires</p>
          <CommentThread commentaires={commentaires} onAjouter={ajouterCommentaire} auteurNom={nomActif} />
        </Modal>
      )}
    </div>
  );
}
