"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SelectionIngenieur from "@/components/SelectionIngenieur";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import Horloge from "@/components/Horloge";
import { useAppData } from "@/lib/useAppData";
import { useIngenieurSelectionne } from "@/lib/useIngenieurSelectionne";

function estAujourdHui(dateStr) {
  const d = new Date(dateStr);
  const auj = new Date();
  return (
    d.getFullYear() === auj.getFullYear() &&
    d.getMonth() === auj.getMonth() &&
    d.getDate() === auj.getDate()
  );
}

function ancienneteJours(dateStr) {
  const d = new Date(dateStr);
  const auj = new Date();
  return Math.floor((auj - d) / (1000 * 60 * 60 * 24));
}

export default function MesDossiersPage() {
  const { profile, erreurProfil, loading, supabase } = useAppData();
  const { nom, pret, selectionner, changerDePersonne } = useIngenieurSelectionne();
  const [ingenieursAvecPin, setIngenieursAvecPin] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const [commentaireEnCours, setCommentaireEnCours] = useState({}); // { [dossierId]: texte }

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

  async function envoyerPourVerification(d) {
    const texteCommentaire = (commentaireEnCours[d.id] || "").trim();

    await supabase
      .from("dossiers")
      .update({ etat: "En attente de vérification", date_soumission: new Date().toISOString() })
      .eq("id", d.id);

    await supabase.from("dossier_evenements").insert({
      dossier_id: d.id,
      type: "soumission_verification",
      effectue_par_nom: nom,
    });

    if (texteCommentaire) {
      await supabase.from("dossier_commentaires").insert({
        dossier_id: d.id,
        auteur_nom: nom,
        contenu: texteCommentaire,
      });
    }

    setCommentaireEnCours((c) => ({ ...c, [d.id]: "" }));
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

  const nonTraites = dossiers.filter(
    (d) => ["Encours", "en pause"].includes(d.etat)
  );
  const aujourdHui = nonTraites.filter((d) => estAujourdHui(d.date));
  const ancien = nonTraites
    .filter((d) => !estAujourdHui(d.date))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const enAttenteVerif = dossiers.filter((d) =>
    ["En attente de vérification", "En cours de vérification"].includes(d.etat)
  );
  const traites = dossiers.filter(
    (d) => !["Encours", "en pause", "En attente de vérification", "En cours de vérification"].includes(d.etat)
  );

  function LigneDossier({ d }) {
    const enRetour = d.retour_interne || d.retour_client;
    return (
      <div className={`p-4 ${enRetour ? "bg-isoRed/5" : ""}`}>
        <div className="flex justify-between items-start gap-3">
          <div className="flex-1">
            <p className="font-medium flex items-center gap-2 flex-wrap">
              {d.nom_dossier}
              {enRetour && (
                <span className="badge bg-isoRed/10 text-isoRed">
                  {d.retour_interne ? "Retour interne" : "Retour client"}
                  {d.nb_retours > 0 && ` — Retour ${d.nb_retours}`}
                </span>
              )}
            </p>
            {enRetour && (
              <p className="text-sm text-ink/70 mt-1">
                Cause : {d.retour_interne ? d.cause_retour_interne : d.cause_retour_client}
              </p>
            )}
            <p className="text-xs text-ink/40">
              {d.nom_operation} · {d.client}
              {!estAujourdHui(d.date) && (
                <span className="text-isoGold ml-2">· depuis {ancienneteJours(d.date)} j</span>
              )}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end shrink-0">
            <div className="flex gap-2">
              {d.nb_retours > 0 && (
                <button
                  onClick={() => setDossierHistorique(d)}
                  className="btn-secondary !py-1 !px-3 text-xs"
                >
                  Historique
                </button>
              )}
              <button onClick={() => envoyerPourVerification(d)} className="btn-primary !py-1 !px-3 text-xs">
                Envoyer pour vérification
              </button>
            </div>
            <input
              type="text"
              placeholder="Commentaire (optionnel)"
              value={commentaireEnCours[d.id] || ""}
              onChange={(e) => setCommentaireEnCours((c) => ({ ...c, [d.id]: e.target.value }))}
              className="border rounded-md px-2 py-1 text-xs w-48"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar role={profile.role} nom={nom} onChangerPersonne={changerDePersonne} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex justify-between items-baseline mb-1">
          <h1 className="font-display text-2xl font-bold">Mes dossiers</h1>
          <Horloge />
        </div>
        <p className="text-ink/50 mb-6">Bonjour {nom}, voici ce qu'il te reste à traiter.</p>

        <h2 className="font-display text-lg font-semibold mb-3">À traiter aujourd'hui</h2>
        <div className="card divide-y mb-8">
          {aujourdHui.map((d) => <LigneDossier key={d.id} d={d} />)}
          {enAttenteVerif.map((d) => (
            <div key={d.id} className="p-4 flex justify-between items-center">
              <p className="font-medium">{d.nom_dossier}</p>
              <span className="badge bg-isoGold/10 text-isoGold">{d.etat}</span>
            </div>
          ))}
          {aujourdHui.length === 0 && enAttenteVerif.length === 0 && (
            <p className="p-8 text-center text-ink/40">Rien à traiter pour l'instant. 🎉</p>
          )}
        </div>

        {ancien.length > 0 && (
          <>
            <h2 className="font-display text-lg font-semibold mb-3">À traiter (ancien)</h2>
            <div className="card overflow-x-auto mb-8">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-ink/50 uppercase border-b">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Nom dossier</th>
                    <th className="px-3 py-2">Opération</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Ancienneté</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {ancien.map((d) => {
                    const jours = ancienneteJours(d.date);
                    const enRetour = d.retour_interne || d.retour_client;
                    return (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">{d.date}</td>
                        <td className="px-3 py-2 font-medium">{d.nom_dossier}</td>
                        <td className="px-3 py-2">{d.nom_operation}</td>
                        <td className="px-3 py-2">
                          {enRetour ? (
                            <span className="badge bg-isoRed/10 text-isoRed">
                              Retour {d.nb_retours > 0 ? d.nb_retours : ""}
                            </span>
                          ) : (
                            <span className="text-ink/40">En cours</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={jours > 3 ? "text-isoRed font-medium" : "text-isoGold"}>
                            {jours} j
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2 justify-end">
                            {d.nb_retours > 0 && (
                              <button
                                onClick={() => setDossierHistorique(d)}
                                className="btn-secondary !py-1 !px-2 text-xs"
                              >
                                Historique
                              </button>
                            )}
                            <button
                              onClick={() => envoyerPourVerification(d)}
                              className="btn-primary !py-1 !px-2 text-xs"
                            >
                              Envoyer
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        <h2 className="font-display text-lg font-semibold mb-3">Tous mes dossiers traités</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink/50 uppercase border-b">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Nom dossier</th>
                <th className="px-3 py-2">Opération</th>
                <th className="px-3 py-2">État final</th>
                <th className="px-3 py-2">Validé par</th>
                <th className="px-3 py-2">Vérifié le</th>
              </tr>
            </thead>
            <tbody>
              {traites.map((d) => (
                <tr key={d.id} className="border-b last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap">{d.date}</td>
                  <td className="px-3 py-2 font-medium">{d.nom_dossier}</td>
                  <td className="px-3 py-2">{d.nom_operation}</td>
                  <td className="px-3 py-2">{d.etat}</td>
                  <td className="px-3 py-2">{d.valide_par || "—"}</td>
                  <td className="px-3 py-2">
                    {d.date_verification ? new Date(d.date_verification).toLocaleDateString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
              {traites.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-8 text-center text-ink/40">Rien encore.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

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
