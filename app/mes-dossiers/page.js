"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SelectionPersonne from "@/components/SelectionPersonne";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import HorlogeDigitale from "@/components/HorlogeDigitale";
import { useAppData } from "@/lib/useAppData";
import { useIngenieurSelectionne } from "@/lib/useNomSelectionne";

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

const AUJOURD_HUI_ISO = new Date().toISOString().slice(0, 10);

export default function MesDossiersPage() {
  const { profile, erreurProfil, loading, supabase } = useAppData();
  const { nom, pret, selectionner, changerDePersonne } = useIngenieurSelectionne();
  const [ingenieursAvecPin, setIngenieursAvecPin] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [objectifsJour, setObjectifsJour] = useState([]); // liste d'objectifs du jour, par opération
  const [dossiersEquipeAujourdHui, setDossiersEquipeAujourdHui] = useState([]); // tous les dossiers de l'équipe, pour la progression collective
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const [commentaireEnCours, setCommentaireEnCours] = useState({});

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

  async function chargerObjectifsEtProgressionEquipe() {
    const [{ data: objs }, { data: doss }] = await Promise.all([
      supabase.from("objectifs_journaliers").select("*").eq("date", AUJOURD_HUI_ISO),
      supabase.from("dossiers").select("nom_operation, nature_prod, date").eq("date", AUJOURD_HUI_ISO),
    ]);
    setObjectifsJour(objs || []);
    setDossiersEquipeAujourdHui(doss || []);
  }

  useEffect(() => {
    chargerDossiers();
    chargerObjectifsEtProgressionEquipe();
  }, [nom]);

  async function accepterDossier(d) {
    await supabase
      .from("dossiers")
      .update({ etat: "Encours", date_acceptation: new Date().toISOString() })
      .eq("id", d.id);

    await supabase.from("dossier_evenements").insert({
      dossier_id: d.id,
      type: "acceptation",
      effectue_par_nom: nom,
    });

    chargerDossiers();
  }

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
    return (
      <SelectionPersonne
        personnes={ingenieursAvecPin}
        onSelection={selectionner}
        sousTitre="Qui es-tu ?"
      />
    );
  }

  const nouveauxAssignes = dossiers.filter((d) => d.etat === "En attente de traitement");
  const nonTraites = dossiers.filter((d) => ["Encours", "en pause"].includes(d.etat));
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

  // Progression du jour, par opération : équipe entière (tous) + personnelle (cet ingénieur)
  const traitesAujourdHui = dossiers.filter((d) => d.date === AUJOURD_HUI_ISO);
  const operationsAvecActivite = [
    ...new Set([...objectifsJour.map((o) => o.operation), ...traitesAujourdHui.map((d) => d.nom_operation)]),
  ];
  const progressionParOperation = operationsAvecActivite.map((op) => {
    const objectif = objectifsJour.find((o) => o.operation === op);
    const equipeOp = dossiersEquipeAujourdHui.filter((d) => d.nom_operation === op);
    const persoOp = traitesAujourdHui.filter((d) => d.nom_operation === op);
    return {
      operation: op,
      objectif,
      equipeNv: equipeOp.filter((d) => d.nature_prod === "Nouveau dossier").length,
      equipeModif: equipeOp.filter((d) => d.nature_prod === "Modification").length,
      persoNv: persoOp.filter((d) => d.nature_prod === "Nouveau dossier").length,
      persoModif: persoOp.filter((d) => d.nature_prod === "Modification").length,
    };
  });

  function TableauDossiers({ titre, liste, avecAnciennete }) {
    return (
      <>
        <h2 className="font-display text-lg font-semibold mb-3">{titre}</h2>
        <div className="card overflow-x-auto mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink/50 uppercase border-b">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Nom dossier</th>
                <th className="px-3 py-2">Opération</th>
                <th className="px-3 py-2">Nature</th>
                <th className="px-3 py-2">Statut</th>
                {avecAnciennete && <th className="px-3 py-2">Ancienneté</th>}
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {liste.map((d) => {
                const enRetour = d.retour_interne || d.retour_client;
                const jours = ancienneteJours(d.date);
                return (
                  <tr key={d.id} className={`border-b last:border-0 ${enRetour ? "bg-isoRed/5" : ""}`}>
                    <td className="px-3 py-2 whitespace-nowrap">{d.date}</td>
                    <td className="px-3 py-2 font-medium">{d.nom_dossier}</td>
                    <td className="px-3 py-2">{d.nom_operation}</td>
                    <td className="px-3 py-2 text-ink/60">{d.nature_prod || "—"}</td>
                    <td className="px-3 py-2">
                      {enRetour ? (
                        <div>
                          <span className="badge bg-isoRed/10 text-isoRed">
                            {d.retour_interne ? "Retour interne" : "Retour client"}
                            {d.nb_retours > 0 && ` — ${d.nb_retours}`}
                          </span>
                          <p className="text-xs text-ink/50 mt-1">
                            {d.retour_interne ? d.cause_retour_interne : d.cause_retour_client}
                          </p>
                        </div>
                      ) : (
                        <span className="text-ink/40">En cours</span>
                      )}
                    </td>
                    {avecAnciennete && (
                      <td className="px-3 py-2">
                        <span className={jours > 3 ? "text-isoRed font-medium" : "text-isoGold"}>
                          {jours} j
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-1.5 items-end">
                        <div className="flex gap-2">
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
                            className="btn-primary !py-1 !px-2 text-xs whitespace-nowrap"
                          >
                            Envoyer
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="Commentaire (optionnel)"
                          value={commentaireEnCours[d.id] || ""}
                          onChange={(e) => setCommentaireEnCours((c) => ({ ...c, [d.id]: e.target.value }))}
                          className="border rounded-md px-2 py-1 text-xs w-40"
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {liste.length === 0 && (
                <tr>
                  <td colSpan={avecAnciennete ? 7 : 6} className="px-3 py-8 text-center text-ink/40">
                    Rien ici pour l'instant. 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div>
      <Navbar role={profile.role} nom={nom} onChangerPersonne={changerDePersonne} />

      {/* Logo agrandi, collé au bord supérieur — se fond avec la bande blanche de la Navbar */}
      <img
        src="/logo-hillsolution.png"
        alt="Hill Solution"
        className="hidden xl:block fixed top-[88px] left-6 w-44 z-0"
        style={{ imageRendering: "auto" }}
      />

      <main className="max-w-4xl mx-auto px-6 py-8 relative z-10">
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="text-ink/50">Bonjour {nom}, voici ce qu'il te reste à traiter.</p>
          </div>
          <HorlogeDigitale />
        </div>

        {progressionParOperation.length > 0 && (
          <div className="card p-4 mb-6">
            <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
              Aujourd'hui, par opération
            </p>
            <div className="flex flex-col gap-3">
              {progressionParOperation.map((p) => (
                <div key={p.operation} className="text-sm">
                  <p className="font-medium">{p.operation}</p>
                  <p className="text-ink/60">
                    Équipe :{" "}
                    {p.objectif ? (
                      <>
                        <strong>{p.equipeNv}/{p.objectif.objectif_nv_dossier}</strong> nouveaux dossiers ·{" "}
                        <strong>{p.equipeModif}/{p.objectif.objectif_modif}</strong> modifications
                      </>
                    ) : (
                      <>
                        <strong>{p.equipeNv}</strong> nouveaux dossiers · <strong>{p.equipeModif}</strong> modifications
                      </>
                    )}
                  </p>
                  <p className="text-ink/40 text-xs">
                    Toi : {p.persoNv} nouveau(x) dossier(s), {p.persoModif} modification(s)
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {nouveauxAssignes.length > 0 && (
          <>
            <h2 className="font-display text-lg font-semibold mb-3 flex items-center gap-2">
              📥 Nouveaux dossiers assignés
              <span className="badge bg-isoGold/10 text-isoGold">{nouveauxAssignes.length}</span>
            </h2>
            <div className="card divide-y mb-8">
              {nouveauxAssignes.map((d) => (
                <div key={d.id} className="p-4 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{d.nom_dossier}</p>
                    <p className="text-xs text-ink/40">{d.nom_operation} · {d.client} · {d.nature_prod}</p>
                  </div>
                  <button onClick={() => accepterDossier(d)} className="btn-primary !py-1.5 !px-4 text-sm">
                    Accepter
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        <TableauDossiers titre="À traiter aujourd'hui" liste={aujourdHui} avecAnciennete={false} />

        {enAttenteVerif.length > 0 && (
          <div className="card divide-y mb-8">
            {enAttenteVerif.map((d) => (
              <div key={d.id} className="p-4 flex justify-between items-center">
                <p className="font-medium">{d.nom_dossier}</p>
                <span className="badge bg-isoGold/10 text-isoGold">{d.etat}</span>
              </div>
            ))}
          </div>
        )}

        {ancien.length > 0 && <TableauDossiers titre="À traiter" liste={ancien} avecAnciennete={true} />}

        <h2 className="font-display text-lg font-semibold mb-3">Tous mes dossiers traités</h2>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink/50 uppercase border-b">
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Nom dossier</th>
                <th className="px-3 py-2">Opération</th>
                <th className="px-3 py-2">Nature</th>
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
                  <td className="px-3 py-2 text-ink/60">{d.nature_prod || "—"}</td>
                  <td className="px-3 py-2">{d.etat}</td>
                  <td className="px-3 py-2">{d.valide_par || "—"}</td>
                  <td className="px-3 py-2">
                    {d.date_verification ? new Date(d.date_verification).toLocaleDateString("fr-FR") : "—"}
                  </td>
                </tr>
              ))}
              {traites.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-ink/40">Rien encore.</td></tr>
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
