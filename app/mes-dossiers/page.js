"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SelectionPersonne from "@/components/SelectionPersonne";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import VueCalendrier from "@/components/VueCalendrier";
import FicheBeneficiaire from "@/components/FicheBeneficiaire";
import FichiersDossier from "@/components/FichiersDossier";
import PageHeader, { SectionTitle } from "@/components/ui/PageHeader";
import StatutBadge from "@/components/ui/StatutBadge";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import UndoToast from "@/components/ui/UndoToast";
import { EcranChargement, EcranErreurProfil } from "@/components/ui/Screens";
import { useAppData } from "@/lib/useAppData";
import { useIngenieurSelectionne } from "@/lib/useNomSelectionne";
import { formatDate, formatDuree, S } from "@/lib/constants";
import { enregistrerEvenement, annulerAction, instantane } from "@/lib/actions";

const AUJOURD_HUI_ISO = new Date().toISOString().slice(0, 10);

function Chrono({ depuis, delaiMaxHeures }) {
  const [, forcer] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forcer((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);
  if (!depuis) return null;
  const ecoule = (Date.now() - new Date(depuis).getTime()) / 3600000;
  const reste = delaiMaxHeures ? delaiMaxHeures - ecoule : null;
  const depasse = reste !== null && reste < 0;
  return (
    <div className="flex flex-col items-end">
      <span className="font-display text-2xl font-extrabold tabular leading-none">{formatDuree(ecoule)}</span>
      {reste !== null && (
        <span className={`text-xs font-semibold mt-1 ${depasse ? "text-isoRed" : "text-isoGold-dark"}`}>
          {depasse ? `Délai dépassé de ${formatDuree(-reste)}` : `Il te reste ${formatDuree(reste)}`}
        </span>
      )}
    </div>
  );
}

export default function MesDossiersPage() {
  const { profile, erreurProfil, loading, supabase } = useAppData();
  const { nom, pret, selectionner, changerDePersonne } = useIngenieurSelectionne();
  const [ingenieursAvecPin, setIngenieursAvecPin] = useState([]);
  const [dossiers, setDossiers] = useState([]);
  const [objectifsJour, setObjectifsJour] = useState([]);
  const [dossiersEquipeAujourdHui, setDossiersEquipeAujourdHui] = useState([]);
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const [commentaire, setCommentaire] = useState("");
  const [vue, setVue] = useState("liste");
  const [delaiMaxHeures, setDelaiMaxHeures] = useState(null);
  const [derniereAction, setDerniereAction] = useState(null);
  const [dernierRetour, setDernierRetour] = useState(null);
  const [erreursFiche, setErreursFiche] = useState([]);
  const [prise, setPrise] = useState({ enCours: false, message: "" });

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: ings }, { data: config }] = await Promise.all([
        supabase.from("parametres_ingenieurs").select("nom, pin").eq("actif", true).order("nom"),
        supabase.from("parametres_config").select("*").limit(1).maybeSingle(),
      ]);
      setIngenieursAvecPin(ings || []);
      if (config) setDelaiMaxHeures(config.delai_max_traitement_heures);
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

  async function chargerProgressionEquipe() {
    const [{ data: objs }, { data: doss }] = await Promise.all([
      supabase.from("objectifs_journaliers").select("*").eq("date", AUJOURD_HUI_ISO),
      supabase.from("dossiers").select("nom_operation, nature_prod, date").eq("date", AUJOURD_HUI_ISO),
    ]);
    setObjectifsJour(objs || []);
    setDossiersEquipeAujourdHui(doss || []);
  }

  useEffect(() => {
    chargerDossiers();
    chargerProgressionEquipe();
  }, [nom]);

  const enCours = dossiers.find((d) => d.etat === S.EN_COURS) || null;

  // Remarques du dernier retour + erreurs fréquentes de la fiche, pour le dossier en cours
  useEffect(() => {
    if (!enCours) {
      setDernierRetour(null);
      setErreursFiche([]);
      return;
    }
    (async () => {
      const [{ data: ret }, { data: fiche }] = await Promise.all([
        supabase.from("dossier_retours").select("*").eq("dossier_id", enCours.id).order("created_at", { ascending: false }).limit(1),
        supabase
          .from("dossier_retours")
          .select("cause, explication, bibliotheque")
          .eq("operation", enCours.nom_operation)
          .order("created_at", { ascending: false })
          .limit(400),
      ]);
      setDernierRetour(enCours.a_corriger ? ret?.[0] || null : null);
      const compte = {};
      for (const r of fiche || []) {
        if (!compte[r.cause]) compte[r.cause] = { cause: r.cause, total: 0, explication: null, bib: false };
        compte[r.cause].total += 1;
        if (r.bibliotheque) {
          compte[r.cause].bib = true;
          compte[r.cause].explication = compte[r.cause].explication || r.explication;
        }
      }
      setErreursFiche(
        Object.values(compte)
          .sort((a, b) => (b.bib ? 1 : 0) - (a.bib ? 1 : 0) || b.total - a.total)
          .slice(0, 3)
      );
    })();
  }, [enCours?.id]);

  function memoriser(d, libelle, evenementId) {
    const action = { dossierId: d.id, nomDossier: d.nom_dossier, libelle, ancienChamps: instantane(d), evenementId };
    setDerniereAction(action);
    setTimeout(() => setDerniereAction((a) => (a === action ? null : a)), 9000);
  }

  async function annulerDerniereAction() {
    if (!derniereAction) return;
    await annulerAction(supabase, derniereAction);
    setDerniereAction(null);
    chargerDossiers();
  }

  async function prendreLeSuivant() {
    setPrise({ enCours: true, message: "" });
    const { data, error } = await supabase.rpc("fn_prendre_suivant", { p_ingenieur: nom });
    if (error) {
      setPrise({
        enCours: false,
        message: error.message.includes("deja_en_cours")
          ? "Tu as déjà un dossier en cours : termine-le d'abord."
          : "Impossible de prendre un dossier : " + error.message,
      });
      return;
    }
    const pris = Array.isArray(data) ? data[0] : data;
    setPrise({
      enCours: false,
      message: pris ? "" : "Aucun dossier disponible pour tes fiches. La Qualité peut t'en assigner un à la main.",
    });
    chargerDossiers();
  }

  async function terminer(d, suivant = false) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("dossiers")
      .update({ etat: S.A_CONTROLER, date_soumission: new Date().toISOString(), a_corriger: false })
      .eq("id", d.id);
    if (error) return alert("Action impossible : " + error.message);
    const evt = await enregistrerEvenement(supabase, d.id, "soumission_verification", { nom });
    if (commentaire.trim()) {
      await supabase.from("dossier_commentaires").insert({
        dossier_id: d.id,
        auteur_id: user?.id,
        auteur_nom: nom,
        contenu: commentaire.trim(),
      });
    }
    memoriser(d, "Envoyé au contrôle", evt);
    setCommentaire("");
    if (suivant) {
      // « Terminé → suivant » : le dossier suivant est attribué automatiquement
      await prendreLeSuivant();
    } else {
      chargerDossiers();
    }
  }

  async function mettreEnAttente(d) {
    const motif = window.prompt("Quelle info manque ? (obligatoire)");
    if (!motif || !motif.trim()) return;
    const { error } = await supabase.from("dossiers").update({ etat: S.ATTENTE_INFO, motif_statut: motif.trim() }).eq("id", d.id);
    if (error) return alert("Action impossible : " + error.message);
    const evt = await enregistrerEvenement(supabase, d.id, "attente_info", { nom, cause: motif.trim() });
    memoriser(d, "Mis en attente d'info", evt);
    chargerDossiers();
  }

  async function reprendre(d) {
    if (enCours) return alert("Termine d'abord ton dossier en cours.");
    const { error } = await supabase
      .from("dossiers")
      .update({ etat: S.EN_COURS, motif_statut: null, date_acceptation: d.date_acceptation || new Date().toISOString() })
      .eq("id", d.id);
    if (error) return alert("Action impossible : " + error.message);
    const evt = await enregistrerEvenement(supabase, d.id, "reprise", { nom });
    memoriser(d, "Dossier repris", evt);
    chargerDossiers();
  }

  if (erreurProfil) return <EcranErreurProfil message={erreurProfil} />;
  if (loading || !profile || !pret) return <EcranChargement />;
  if (!nom) {
    return profile.role === "admin" ? (
      <SelectionPersonne
        personnes={ingenieursAvecPin}
        onSelection={selectionner}
        sansCode
        titre="Vue ingénieur"
        sousTitre="Aperçu admin : choisis l'ingénieur dont tu veux voir l'écran."
      />
    ) : (
      <SelectionPersonne personnes={ingenieursAvecPin} onSelection={selectionner} />
    );
  }

  const maListe = dossiers
    .filter((d) => d.etat === S.ASSIGNE)
    .sort((a, b) => (b.a_corriger ? 1 : 0) - (a.a_corriger ? 1 : 0) || (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0));
  const attenteInfo = dossiers.filter((d) => d.etat === S.ATTENTE_INFO);
  const auControle = dossiers.filter((d) => [S.A_CONTROLER, "En cours de vérification"].includes(d.etat));
  const traites = dossiers.filter((d) => [S.VALIDE, "Dossier vérifié"].includes(d.etat));

  // Progression du jour, par opération (équipe + perso)
  const traitesAujourdHui = dossiers.filter((d) => d.date === AUJOURD_HUI_ISO);
  const operationsAvecActivite = [...new Set([...objectifsJour.map((o) => o.operation), ...traitesAujourdHui.map((d) => d.nom_operation)])];
  const progression = operationsAvecActivite.map((op) => {
    const objectif = objectifsJour.find((o) => o.operation === op);
    const equipeOp = dossiersEquipeAujourdHui.filter((d) => d.nom_operation === op);
    return {
      operation: op,
      objectif,
      equipeNv: equipeOp.filter((d) => d.nature_prod === "Nouveau dossier").length,
      equipeModif: equipeOp.filter((d) => d.nature_prod === "Modification").length,
    };
  });

  function barre(valeur, objectif) {
    if (!objectif) return null;
    const pct = Math.min(100, Math.round((valeur / objectif) * 100));
    return (
      <div className="h-1.5 rounded-full bg-ink/[0.06] overflow-hidden mt-1">
        <div className={`h-full rounded-full ${pct >= 100 ? "bg-isoGreen" : "bg-brand-500"}`} style={{ width: `${pct}%` }} />
      </div>
    );
  }

  function listeSimple(lignes, action) {
    return (
      <div className="card divide-y divide-line">
        {lignes.map((d) => (
          <div key={d.id} className="px-5 py-3 flex flex-wrap justify-between items-center gap-3">
            <div className="min-w-0">
              <p className="font-semibold flex items-center gap-1.5 flex-wrap">
                {d.prioritaire && <Icon name="flame" size={14} className="text-isoRed" />}
                {d.nom_dossier}
                {d.a_corriger && <span className="badge badge-red">Retour à corriger</span>}
              </p>
              <p className="text-xs text-ink/50">
                {[d.nom_operation, d.beneficiaire_nom, d.motif_statut && `Motif : ${d.motif_statut}`].filter(Boolean).join(" · ")}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {action ? action(d) : <StatutBadge etat={d.etat} />}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nom} onChangerPersonne={changerDePersonne} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="folder"
          titre="Mes dossiers"
          sousTitre={
            <>
              Bonjour <span className="capitalize font-medium text-ink/80">{nom}</span> — un dossier à la fois.
            </>
          }
          actions={
            <div className="flex items-center gap-4">
              <div className="segmented">
                <button data-active={vue === "liste"} onClick={() => setVue("liste")}>
                  <Icon name="list" size={13} />
                  Liste
                </button>
                <button data-active={vue === "calendrier"} onClick={() => setVue("calendrier")}>
                  <Icon name="calendar" size={13} />
                  Calendrier
                </button>
              </div>
            </div>
          }
        />

        {vue === "calendrier" ? (
          <VueCalendrier dossiers={dossiers} />
        ) : (
          <>
            {/* Carte principale : le dossier en cours, ou « Prendre le suivant » */}
            {enCours ? (
              <section className="card border-brand-300 ring-2 ring-brand-500/10 mb-8 overflow-hidden">
                <div className="px-6 py-5 flex flex-wrap items-start justify-between gap-4 border-b border-line bg-brand-50/40">
                  <div className="min-w-0">
                    <p className="eyebrow text-brand-600 mb-1">Dossier en cours</p>
                    <h2 className="font-display text-2xl font-extrabold flex items-center gap-2 flex-wrap">
                      {enCours.nom_dossier}
                      {enCours.prioritaire && <span className="badge badge-red"><Icon name="flame" size={12} />Prioritaire</span>}
                    </h2>
                    <p className="text-sm text-ink/60 mt-1">
                      {[enCours.nom_operation, enCours.nature_prod, enCours.client].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Chrono depuis={enCours.date_acceptation} delaiMaxHeures={delaiMaxHeures} />
                </div>

                <div className="px-6 py-5 grid md:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-4">
                    {dernierRetour && (
                      <div className="alert alert-red">
                        <Icon name="undo" size={16} className="mt-0.5" />
                        <div>
                          <p className="font-semibold">À corriger : {dernierRetour.cause}</p>
                          {dernierRetour.commentaire && <p className="mt-1">{dernierRetour.commentaire}</p>}
                          <p className="text-xs opacity-70 mt-1">
                            Retour {dernierRetour.type} du {new Date(dernierRetour.created_at).toLocaleDateString("fr-FR")}
                            {dernierRetour.effectue_par_nom ? ` par ${dernierRetour.effectue_par_nom}` : ""}
                          </p>
                        </div>
                      </div>
                    )}
                    <div>
                      <p className="eyebrow mb-2">Bénéficiaire</p>
                      <FicheBeneficiaire dossier={enCours} compact />
                    </div>
                    <div>
                      <p className="eyebrow mb-2">Pièces du dossier</p>
                      <FichiersDossier
                        key={"f" + enCours.id}
                        supabase={supabase}
                        dossier={enCours}
                        auteur={nom}
                        peutDeposerPieces={false}
                        peutDeposerLivrables
                        peutSupprimer={false}
                        compact
                      />
                    </div>
                  </div>

                  <div>
                    <p className="eyebrow mb-2 flex items-center gap-1.5">
                      <Icon name="alert" size={12} />
                      Erreurs fréquentes sur {enCours.nom_operation}
                    </p>
                    {erreursFiche.length === 0 ? (
                      <p className="text-sm text-ink/45">Aucun retour enregistré sur cette fiche pour l'instant.</p>
                    ) : (
                      <ol className="flex flex-col gap-2">
                        {erreursFiche.map((e, i) => (
                          <li key={e.cause} className="flex gap-3 text-sm bg-isoGold-light/60 rounded-lg px-3 py-2">
                            <span className="font-display font-extrabold text-isoGold-dark">{i + 1}</span>
                            <span>
                              <span className="font-semibold">{e.cause}</span>
                              <span className="text-ink/45"> · {e.total} retour{e.total > 1 ? "s" : ""}</span>
                              {e.explication && <span className="block text-ink/65 text-xs mt-0.5">{e.explication}</span>}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-line bg-paper/60 flex flex-wrap items-center gap-2">
                  <input
                    className="input flex-1 min-w-[220px]"
                    placeholder="Commentaire pour la Qualité (optionnel)"
                    value={commentaire}
                    onChange={(e) => setCommentaire(e.target.value)}
                  />
                  <button className="btn-secondary" onClick={() => mettreEnAttente(enCours)}>
                    <Icon name="clock" size={15} />
                    En attente d'info
                  </button>
                  <button className="btn-secondary" onClick={() => terminer(enCours, false)} title="Envoie au contrôle sans prendre de nouveau dossier (pause, fin de journée)">
                    <Icon name="check" size={15} />
                    Terminé, je m'arrête
                  </button>
                  <button className="btn-primary" onClick={() => terminer(enCours, true)}>
                    <Icon name="send" size={15} />
                    Terminé → suivant
                  </button>
                  <button className="btn-icon" title="Historique" onClick={() => setDossierHistorique(enCours)}>
                    <Icon name="history" size={16} />
                  </button>
                </div>
              </section>
            ) : (
              <section className="card mb-8 px-6 py-10 flex flex-col items-center text-center gap-3">
                <span className="w-14 h-14 rounded-2xl bg-brand-50 text-brand-500 flex items-center justify-center">
                  <Icon name="inbox" size={26} />
                </span>
                <p className="font-display text-xl font-bold">Aucun dossier en cours</p>
                <p className="text-sm text-ink/55 max-w-md">
                  {maListe.length
                    ? `${maListe.length} dossier(s) t'attendent (retours en premier). Clique pour commencer le suivant.`
                    : "Prends le prochain dossier de la file, parmi les fiches sur lesquelles tu es habilité."}
                </p>
                <button className="btn-primary h-11 px-6 text-[15px] mt-2" onClick={prendreLeSuivant} disabled={prise.enCours}>
                  <Icon name="chevronRight" size={16} />
                  {prise.enCours ? "Recherche…" : "Prendre le suivant"}
                </button>
                {prise.message && <p className="text-sm text-isoGold-dark">{prise.message}</p>}
              </section>
            )}

            {maListe.length > 0 && (
              <section className="mb-8">
                <SectionTitle icone="list" titre="Ma liste (dans cet ordre)" compteur={maListe.length} ton="brand" />
                {listeSimple(maListe)}
              </section>
            )}

            {attenteInfo.length > 0 && (
              <section className="mb-8">
                <SectionTitle icone="clock" titre="En attente d'info" compteur={attenteInfo.length} ton="gold" />
                {listeSimple(attenteInfo, (d) => (
                  <button className="btn-secondary btn-sm" onClick={() => reprendre(d)} disabled={!!enCours} title={enCours ? "Termine d'abord ton dossier en cours" : ""}>
                    <Icon name="reset" size={13} />
                    Reprendre
                  </button>
                ))}
              </section>
            )}

            {auControle.length > 0 && (
              <section className="mb-8">
                <SectionTitle icone="shield" titre="Envoyés au contrôle" compteur={auControle.length} ton="gold" />
                {listeSimple(auControle)}
              </section>
            )}

            {progression.length > 0 && (
              <div className="card mb-8">
                <div className="card-header border-b border-line">
                  <p className="card-title">
                    <Icon name="target" size={15} className="text-ink/40" />
                    L'équipe aujourd'hui, par opération
                  </p>
                </div>
                <div className="overflow-hidden rounded-b-card">
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 -mr-px -mb-px">
                    {progression.map((p) => (
                      <div key={p.operation} className="p-4 text-sm border-r border-b border-line">
                        <p className="font-semibold mb-2">{p.operation}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-ink/50">Nouveaux</p>
                            <p className="font-display font-bold tabular">
                              {p.equipeNv}
                              {p.objectif && <span className="text-ink/35 font-medium">/{p.objectif.objectif_nv_dossier}</span>}
                            </p>
                            {barre(p.equipeNv, p.objectif?.objectif_nv_dossier)}
                          </div>
                          <div>
                            <p className="text-xs text-ink/50">Modifs</p>
                            <p className="font-display font-bold tabular">
                              {p.equipeModif}
                              {p.objectif && <span className="text-ink/35 font-medium">/{p.objectif.objectif_modif}</span>}
                            </p>
                            {barre(p.equipeModif, p.objectif?.objectif_modif)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <section>
              <SectionTitle icone="checkCircle" titre="Mes dossiers validés" compteur={traites.length} />
              <div className="card overflow-x-auto">
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Dossier</th>
                      <th>Fiche</th>
                      <th>Retours</th>
                      <th>Validé par</th>
                      <th>Le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {traites.map((d) => (
                      <tr key={d.id} className="cursor-pointer" onClick={() => setDossierHistorique(d)}>
                        <td className="whitespace-nowrap text-ink/60 tabular">{formatDate(d.date)}</td>
                        <td>
                          <span className="font-semibold">{d.nom_dossier}</span>
                          {d.beneficiaire_nom && <span className="block text-xs text-ink/50">{d.beneficiaire_nom}</span>}
                        </td>
                        <td className="text-ink/70">{d.nom_operation}</td>
                        <td>
                          {d.nb_retours ? <span className="badge badge-gold">{d.nb_retours}</span> : <span className="badge badge-green">1er coup</span>}
                        </td>
                        <td className="capitalize">{d.valide_par || "—"}</td>
                        <td className="text-ink/60 tabular">
                          {d.date_verification ? new Date(d.date_verification).toLocaleDateString("fr-FR") : "—"}
                        </td>
                      </tr>
                    ))}
                    {traites.length === 0 && (
                      <tr>
                        <td colSpan={6}>
                          <EmptyState icone="checkCircle" texte="Aucun dossier validé pour l'instant." compact />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      {dossierHistorique && (
        <HistoriqueComplet supabase={supabase} dossier={dossierHistorique} onFermer={() => setDossierHistorique(null)} />
      )}

      {derniereAction && (
        <UndoToast message={`${derniereAction.libelle} — « ${derniereAction.nomDossier} »`} onAnnuler={annulerDerniereAction} />
      )}
    </div>
  );
}
