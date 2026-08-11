"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DossierForm from "@/components/DossierForm";
import DossierTable from "@/components/DossierTable";
import CommentThread from "@/components/CommentThread";
import { useAppData } from "@/lib/useAppData";

export default function SaisiePage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [dossiers, setDossiers] = useState([]);
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [commentaires, setCommentaires] = useState([]);

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
    const { data } = await supabase
      .from("dossier_commentaires")
      .select("*")
      .eq("dossier_id", d.id)
      .order("created_at", { ascending: true });
    setCommentaires(data || []);
  }

  async function ajouterCommentaire(texte) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("dossier_commentaires").insert({
      dossier_id: dossierOuvert.id,
      auteur_id: user.id,
      auteur_nom: profile.nom_complet,
      contenu: texte,
    });
    ouvrirDossier(dossierOuvert);
  }

  async function soumettreDossier(form) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = { ...form, created_by: user.id };
    // Nettoyage des champs vides pour les colonnes date
    if (!payload.date_retour_client) payload.date_retour_client = null;
    if (!payload.date_nouvelle_modification) payload.date_nouvelle_modification = null;

    const { error } = await supabase.from("dossiers").insert(payload);
    if (error) {
      alert("Erreur à l'enregistrement : " + error.message);
      return;
    }
    chargerDossiers();
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

  return (
    <div>
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-7xl mx-auto px-6 py-8 grid lg:grid-cols-[1fr_1.2fr] gap-8">
        <DossierForm
          options={options}
          dossiersExistants={dossiers}
          onSubmit={soumettreDossier}
          roleActuel={profile.role}
          ingenieurConnecte={profile.ingenieur_ref}
        />

        <div className="flex flex-col gap-4">
          <h2 className="font-display text-lg font-semibold">Dernières saisies</h2>
          <DossierTable dossiers={dossiers} onOpenDossier={ouvrirDossier} />
        </div>
      </main>

      {dossierOuvert && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30" onClick={() => setDossierOuvert(null)}>
          <div className="card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-display font-semibold text-lg">{dossierOuvert.nom_dossier}</h3>
                <p className="text-sm text-ink/50">{dossierOuvert.ingenieur} · {dossierOuvert.nom_operation}</p>
              </div>
              <button onClick={() => setDossierOuvert(null)} className="text-ink/40 hover:text-ink">✕</button>
            </div>
            <CommentThread
              commentaires={commentaires}
              onAjouter={ajouterCommentaire}
              auteurNom={profile.nom_complet}
            />
          </div>
        </div>
      )}
    </div>
  );
}
