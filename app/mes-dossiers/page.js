"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SelectionIngenieur from "@/components/SelectionIngenieur";
import CommentThread from "@/components/CommentThread";
import { useAppData } from "@/lib/useAppData";
import { useIngenieurSelectionne } from "@/lib/useIngenieurSelectionne";

export default function MesDossiersPage() {
  const { profile, erreurProfil, loading, supabase } = useAppData();
  const { nom, pret, selectionner, changerDePersonne } = useIngenieurSelectionne();
  const [ingenieursAvecPin, setIngenieursAvecPin] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [commentaires, setCommentaires] = useState([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from("parametres_ingenieurs").select("nom, pin").eq("actif", true).order("nom");
      setIngenieursAvecPin(data || []);
    })();
  }, [profile]);

  async function chargerDossiers() {
    if (!nom) return;
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .eq("ingenieur", nom)
      .order("date", { ascending: false })
      .limit(300);
    setDossiers(data || []);
  }

  useEffect(() => {
    chargerDossiers();
  }, [nom]);

  async function ouvrirCommentaires(d) {
    setDossierOuvert(d);
    const { data } = await supabase
      .from("dossier_commentaires")
      .select("*")
      .eq("dossier_id", d.id)
      .order("created_at", { ascending: true });
    setCommentaires(data || []);
  }

  async function ajouterCommentaire(texte) {
    await supabase.from("dossier_commentaires").insert({
      dossier_id: dossierOuvert.id,
      auteur_nom: nom,
      contenu: texte,
    });
    ouvrirCommentaires(dossierOuvert);
  }

  async function envoyerPourVerification(d) {
    await supabase
      .from("dossiers")
      .update({ etat: "En attente de vérification", date_soumission: new Date().toISOString() })
      .eq("id", d.id);
    await supabase.from("dossier_evenements").insert({
      dossier_id: d.id,
      type: "soumission_verification",
      effectue_par_nom: nom,
    });
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
  if (loading || !profile || !pret) return <div className="p-10 text-center text-ink/40">Chargement…</div>;

  if (!nom) {
    return <SelectionIngenieur ingenieursAvecPin={ingenieursAvecPin} onSelection={selectionner} />;
  }

  const enRetour = dossiers.filter((d) => d.retour_interne || d.retour_client)
    .filter((d) => d.etat === "Encours" || d.etat === "en pause");
  const enCours = dossiers.filter(
    (d) => d.etat === "Encours" && !d.retour_interne && !d.retour_client
  );
  const enAttenteVerif = dossiers.filter((d) => d.etat === "En attente de vérification" || d.etat === "En cours de vérification");
  const traites = dossiers.filter((d) => !["Encours", "en pause", "En attente de vérification", "En cours de vérification"].includes(d.etat));

  return (
    <div>
      <Navbar role={profile.role} nom={nom} onChangerPersonne={changerDePersonne} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Mes dossiers</h1>
        <p className="text-ink/50 mb-6">Bonjour {nom}, voici ce qu'il te reste à traiter.</p>

        <h2 className="font-display text-lg font-semibold mb-3">À traiter aujourd'hui</h2>
        <div className="card divide-y mb-8">
          {enRetour.map((d) => (
            <div key={d.id} className="p-4 bg-isoRed/5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">
                    {d.nom_dossier}
                    <span className="badge bg-isoRed/10 text-isoRed ml-2">
                      {d.retour_interne ? "Retour interne" : "Retour client"}
                    </span>
                  </p>
                  <p className="text-sm text-ink/70 mt-1">
                    Cause : {d.retour_interne ? d.cause_retour_interne : d.cause_retour_client}
                  </p>
                  <p className="text-xs text-ink/40">{d.nom_operation} · {d.client}</p>
                </div>
                <div className="flex flex-col gap-2 items-end">
                  <button onClick={() => envoyerPourVerification(d)} className="btn-primary !py-1 !px-3 text-xs">
                    Envoyer pour vérification
                  </button>
                  <button onClick={() => ouvrirCommentaires(d)} className="text-xs text-ink/50 hover:underline">
                    Voir les commentaires
                  </button>
                </div>
              </div>
            </div>
          ))}

          {enCours.map((d) => (
            <div key={d.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{d.nom_dossier}</p>
                  <p className="text-xs text-ink/40">{d.nom_operation} · {d.client}</p>
                </div>
                <button onClick={() => envoyerPourVerification(d)} className="btn-primary !py-1 !px-3 text-xs">
                  Envoyer pour vérification
                </button>
              </div>
            </div>
          ))}

          {enAttenteVerif.map((d) => (
            <div key={d.id} className="p-4">
              <div className="flex justify-between items-center">
                <p className="font-medium">{d.nom_dossier}</p>
                <span className="badge bg-isoGold/10 text-isoGold">{d.etat}</span>
              </div>
            </div>
          ))}

          {enRetour.length === 0 && enCours.length === 0 && enAttenteVerif.length === 0 && (
            <p className="p-8 text-center text-ink/40">Rien à traiter pour l'instant. 🎉</p>
          )}
        </div>

        <h2 className="font-display text-lg font-semibold mb-3">Tous mes dossiers traités</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink/50 uppercase border-b">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Nom dossier</th>
                <th className="px-3 py-2">Opération</th>
                <th className="px-3 py-2">État final</th>
              </tr>
            </thead>
            <tbody>
              {traites.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{d.date}</td>
                  <td className="px-3 py-2 font-medium">{d.nom_dossier}</td>
                  <td className="px-3 py-2">{d.nom_operation}</td>
                  <td className="px-3 py-2">{d.etat}</td>
                </tr>
              ))}
              {traites.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-8 text-center text-ink/40">Rien encore.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {dossierOuvert && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-30" onClick={() => setDossierOuvert(null)}>
          <div className="card p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-display font-semibold text-lg">{dossierOuvert.nom_dossier}</h3>
              <button onClick={() => setDossierOuvert(null)} className="text-ink/40 hover:text-ink">✕</button>
            </div>
            <CommentThread commentaires={commentaires} onAjouter={ajouterCommentaire} auteurNom={nom} />
          </div>
        </div>
      )}
    </div>
  );
}
