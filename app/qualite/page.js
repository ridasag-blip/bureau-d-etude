"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Fragment } from "react";
import Navbar from "@/components/Navbar";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import FicheBeneficiaire from "@/components/FicheBeneficiaire";
import PageHeader, { SectionTitle } from "@/components/ui/PageHeader";
import StatutBadge from "@/components/ui/StatutBadge";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import UndoToast from "@/components/ui/UndoToast";
import { gardePage } from "@/components/ui/Screens";
import { useAppData } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import { formatDuree, S, STATUTS_MANUELS } from "@/lib/constants";
import { enregistrerEvenement, annulerAction, instantane } from "@/lib/actions";

const ETATS_CHARGES = [S.FILE, S.ASSIGNE, S.EN_COURS, S.ATTENTE_INFO, S.A_CONTROLER, "En cours de vérification", S.VALIDE, ...STATUTS_MANUELS];

/** Depuis quand le dossier est dans son étape actuelle (heures). */
function heuresDansEtape(d) {
  const ref = {
    [S.FILE]: d.date_mise_en_file || d.created_at,
    [S.ASSIGNE]: d.date_assignation || d.created_at,
    [S.EN_COURS]: d.date_acceptation,
    [S.A_CONTROLER]: d.date_soumission,
    "En cours de vérification": d.date_soumission,
  }[d.etat];
  if (!ref) return null;
  return (Date.now() - new Date(ref).getTime()) / 3600000;
}

export default function QualitePage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;
  const nomTrace = estAdmin ? null : nomActif;

  const [dossiers, setDossiers] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [seuilHeures, setSeuilHeures] = useState(1);
  const [seuilUrgence, setSeuilUrgence] = useState(24);
  const [dossierActif, setDossierActif] = useState(null);
  const [typeRetour, setTypeRetour] = useState(null); // interne | client
  const [form, setForm] = useState({ cause: "", commentaire: "", reassigner: "", bibliotheque: false });
  const [assignation, setAssignation] = useState("");
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const [derniereAction, setDerniereAction] = useState(null);
  const [replies, setReplies] = useState({ valides: true, autres: true });

  async function chargerDossiers() {
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .in("etat", ETATS_CHARGES)
      .order("date", { ascending: false })
      .limit(3000);
    setDossiers(data || []);
  }

  useEffect(() => {
    if (!profile) return;
    chargerDossiers();
    (async () => {
      const { data } = await supabase.from("parametres_config").select("*").limit(1).maybeSingle();
      if (data) {
        setSeuilHeures(data.seuil_verification_heures);
        setSeuilUrgence(data.seuil_urgence_heures || 24);
      }
    })();
  }, [profile]);

  // Lien direct depuis le point du matin : /qualite#section-file → déplie et fait défiler
  useEffect(() => {
    if (!dossiers.length || typeof window === "undefined") return;
    const cle = window.location.hash.replace("#section-", "");
    if (!cle) return;
    setReplies((r) => ({ ...r, [cle]: false }));
    setTimeout(() => document.getElementById(`section-${cle}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    history.replaceState(null, "", window.location.pathname);
  }, [dossiers.length > 0]);

  function fermerPanneau() {
    setDossierActif(null);
    setTypeRetour(null);
    setForm({ cause: "", commentaire: "", reassigner: "", bibliotheque: false });
    setAssignation("");
  }

  function memoriser(d, libelle, evenementId, retourId) {
    const action = { dossierId: d.id, nomDossier: d.nom_dossier, libelle, ancienChamps: instantane(d), evenementId, retourId };
    setDerniereAction(action);
    setTimeout(() => setDerniereAction((a) => (a === action ? null : a)), 9000);
  }

  async function appliquer(d, champs, libelle, evenement, retour) {
    const { error } = await supabase.from("dossiers").update(champs).eq("id", d.id);
    if (error) {
      alert("Action impossible : " + error.message);
      return false;
    }
    let retourId = null;
    if (retour) {
      const { data: r, error: errR } = await supabase.from("dossier_retours").insert(retour).select("id").single();
      if (errR) console.error("Retour non enregistré :", errR.message);
      retourId = r?.id || null;
    }
    const evenementId = evenement ? await enregistrerEvenement(supabase, d.id, evenement.type, { cause: evenement.cause, nom: nomTrace }) : null;
    memoriser(d, libelle, evenementId, retourId);
    fermerPanneau();
    chargerDossiers();
    return true;
  }

  const habilite = (ing, op) => (options.habilitations?.[ing] || []).includes(op);

  function assigner(d, ing) {
    if (!ing) return;
    return appliquer(
      d,
      { etat: S.ASSIGNE, ingenieur: ing, date_assignation: new Date().toISOString(), hors_habilitation: !habilite(ing, d.nom_operation) },
      `Assigné à ${ing}`,
      { type: d.ingenieur ? "reassignation" : "assignation", cause: `→ ${ing}` }
    );
  }

  function remettreEnFile(d) {
    return appliquer(
      d,
      { etat: S.FILE, ingenieur: null, date_mise_en_file: new Date().toISOString(), hors_habilitation: false, motif_statut: null },
      "Remis dans la file",
      { type: "mise_en_file" }
    );
  }

  function basculerPriorite(d) {
    return appliquer(d, { prioritaire: !d.prioritaire }, d.prioritaire ? "Priorité retirée" : "Marqué prioritaire", null);
  }

  function valider(d) {
    return appliquer(
      d,
      { etat: S.VALIDE, date_verification: new Date().toISOString(), valide_par: nomTrace, a_corriger: false },
      "Dossier validé",
      { type: "verification_ok" }
    );
  }

  function enregistrerRetour(d) {
    if (!form.cause) return alert("Précise la cause du retour.");
    const client = typeRetour === "client";
    const ing = form.reassigner || d.ingenieur;
    const apresValidation = d.etat === S.VALIDE;
    const champs = {
      etat: S.ASSIGNE,
      ingenieur: ing,
      a_corriger: true,
      date_assignation: new Date().toISOString(),
      date_verification: null,
      ingenieur_modif: form.reassigner || null,
      nb_retours: (d.nb_retours || 0) + 1,
      ...(client
        ? { retour_client: true, cause_retour_client: form.cause, date_retour_client: new Date().toISOString().slice(0, 10) }
        : { retour_interne: true, cause_retour_interne: form.cause }),
    };
    return appliquer(
      d,
      champs,
      client ? "Retour client enregistré" : "Retour interne enregistré",
      {
        type: client ? "retour_client" : apresValidation ? "retour_interne_apres_audit" : "retour_interne_avant_audit",
        cause: form.cause + (form.commentaire ? ` — ${form.commentaire}` : ""),
      },
      {
        dossier_id: d.id,
        type: client ? "client" : "interne",
        cause: form.cause,
        commentaire: form.commentaire || null,
        ingenieur: d.ingenieur,
        operation: d.nom_operation,
        effectue_par_nom: nomTrace,
        bibliotheque: form.bibliotheque,
        explication: form.bibliotheque ? form.commentaire || null : null,
      }
    );
  }

  function changerStatutManuel(d, statut) {
    const motif = window.prompt(`Motif du passage en « ${statut} » (obligatoire) :`);
    if (!motif || !motif.trim()) return;
    return appliquer(d, { etat: statut, motif_statut: motif.trim() }, `Statut → ${statut}`, {
      type: "changement_statut_manuel",
      cause: `→ ${statut} : ${motif.trim()}`,
    });
  }

  async function majBeneficiaire(d, champs) {
    const { error } = await supabase.from("dossiers").update(champs).eq("id", d.id);
    if (error) return error.message;
    chargerDossiers();
    return null;
  }

  async function annulerDerniereAction() {
    if (!derniereAction) return;
    const err = await annulerAction(supabase, derniereAction);
    if (err) alert("Annulation impossible : " + err.message);
    setDerniereAction(null);
    chargerDossiers();
  }

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner });
  if (ecran) return ecran;

  function classeTemps(h, etat) {
    if (h === null) return "badge-neutral";
    if (etat !== S.A_CONTROLER && etat !== "En cours de vérification") return h >= seuilUrgence ? "badge-red" : "badge-neutral";
    const ratio = h / seuilHeures;
    if (ratio >= 1) return "badge-red";
    if (ratio >= 0.6) return "badge-gold";
    return "badge-green";
  }

  const q = recherche.trim().toLowerCase();
  const correspond = (d) =>
    !q ||
    [d.nom_dossier, d.beneficiaire_nom, d.beneficiaire_adresse, d.beneficiaire_telephone, d.ingenieur]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));
  const parAnciennete = (a, b) =>
    (b.a_corriger ? 1 : 0) - (a.a_corriger ? 1 : 0) ||
    (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0) ||
    (heuresDansEtape(b) || 0) - (heuresDansEtape(a) || 0);

  const liste = (etats) => dossiers.filter((d) => etats.includes(d.etat)).filter(correspond).sort(parAnciennete);
  const file = liste([S.FILE]);
  const assignes = liste([S.ASSIGNE]);
  const enCours = liste([S.EN_COURS]);
  const attenteInfo = liste([S.ATTENTE_INFO]);
  const aControler = liste([S.A_CONTROLER, "En cours de vérification"]);
  const valides = dossiers
    .filter((d) => d.etat === S.VALIDE)
    .filter(correspond)
    .sort((a, b) => new Date(b.date_verification || b.date) - new Date(a.date_verification || a.date));
  const autres = liste(STATUTS_MANUELS);

  function panneauAction(d) {
    const peutAssigner = [S.FILE, S.ASSIGNE, S.ATTENTE_INFO].includes(d.etat) || STATUTS_MANUELS.includes(d.etat);
    const peutRetour = [S.A_CONTROLER, "En cours de vérification", S.VALIDE].includes(d.etat);
    return (
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 py-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Bénéficiaire</p>
          <FicheBeneficiaire key={d.id} dossier={d} onSave={(c) => majBeneficiaire(d, c)} compact />
          {d.motif_statut && (
            <p className="text-xs text-ink/60">
              <strong>Motif :</strong> {d.motif_statut}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="eyebrow">Actions</p>
          <div className="flex flex-wrap items-center gap-2">
            {(d.etat === S.A_CONTROLER || d.etat === "En cours de vérification") && (
              <>
                <button onClick={() => valider(d)} className="btn-success btn-sm">
                  <Icon name="check" size={14} />
                  Valider
                </button>
                <button
                  onClick={() => setTypeRetour("interne")}
                  className={typeRetour === "interne" ? "btn-sm btn bg-isoGold-light text-isoGold-dark border border-isoGold/40" : "btn-danger btn-sm"}
                >
                  <Icon name="undo" size={14} />
                  Retour interne
                </button>
              </>
            )}
            {d.etat === S.VALIDE && (
              <div className="segmented">
                <button data-active={typeRetour === "interne"} onClick={() => setTypeRetour("interne")}>
                  Faute interne découverte
                </button>
                <button data-active={typeRetour === "client"} onClick={() => setTypeRetour("client")}>
                  Modification client
                </button>
              </div>
            )}
            {[S.FILE, S.ASSIGNE].includes(d.etat) && (
              <button onClick={() => basculerPriorite(d)} className="btn-secondary btn-sm">
                <Icon name="flame" size={14} className={d.prioritaire ? "text-isoRed" : ""} />
                {d.prioritaire ? "Retirer la priorité" : "Rendre prioritaire"}
              </button>
            )}
            {(d.etat === S.ASSIGNE || STATUTS_MANUELS.includes(d.etat) || d.etat === S.ATTENTE_INFO) && (
              <button onClick={() => remettreEnFile(d)} className="btn-secondary btn-sm">
                <Icon name="inbox" size={14} />
                Remettre dans la file
              </button>
            )}
          </div>

          {peutAssigner && (
            <div className="flex flex-wrap items-end gap-2">
              <div className="field flex-1 min-w-[200px]">
                <label className="label">{d.ingenieur ? "Réassigner à" : "Assigner à"}</label>
                <select className="input" value={assignation} onChange={(e) => setAssignation(e.target.value)}>
                  <option value="">Choisir un ingénieur…</option>
                  {options.ingenieurs?.map((i) => (
                    <option key={i} value={i}>
                      {i}
                      {!habilite(i, d.nom_operation) ? " · hors fiche habituelle" : ""}
                      {dossiers.some((x) => x.ingenieur === i && x.etat === S.EN_COURS) ? " · occupé" : " · libre"}
                    </option>
                  ))}
                </select>
              </div>
              <button className="btn-primary btn-sm h-9" disabled={!assignation} onClick={() => assigner(d, assignation)}>
                Assigner
              </button>
            </div>
          )}

          {peutRetour && typeRetour && (
            <div className="flex flex-col gap-2 bg-isoRed-light/60 border border-isoRed/20 rounded-lg p-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <div className="field">
                  <label className="label">Cause du retour {typeRetour}</label>
                  <select className="input" value={form.cause} onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}>
                    <option value="">Choisir…</option>
                    {(typeRetour === "client" ? options.causesClient : options.causesInterne)?.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="label">Renvoyer à</label>
                  <select className="input" value={form.reassigner} onChange={(e) => setForm((f) => ({ ...f, reassigner: e.target.value }))}>
                    <option value="">{d.ingenieur ? `${d.ingenieur} (même ingénieur)` : "Choisir…"}</option>
                    {options.ingenieurs?.filter((i) => i !== d.ingenieur).map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="field">
                <label className="label">Remarque pour l'ingénieur</label>
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Ce qu'il faut corriger, précisément"
                  value={form.commentaire}
                  onChange={(e) => setForm((f) => ({ ...f, commentaire: e.target.value }))}
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[#1F6FA8]"
                    checked={form.bibliotheque}
                    onChange={(e) => setForm((f) => ({ ...f, bibliotheque: e.target.checked }))}
                  />
                  <Icon name="list" size={14} className="text-ink/45" />
                  Ajouter à la bibliothèque des erreurs
                </label>
                <button onClick={() => enregistrerRetour(d)} className="btn-primary btn-sm">
                  Enregistrer le retour
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-3 border-t border-line">
            <span className="text-xs text-ink/45">Mettre de côté :</span>
            {STATUTS_MANUELS.filter((s) => s !== d.etat).map((s) => (
              <button key={s} className="btn-ghost btn-xs" onClick={() => changerStatutManuel(d, s)}>
                {s === "en pause" ? "En pause" : s === "Suspendue" ? "Suspendre" : "Annuler le dossier"}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function tableau({ cle, titre, icone, ton, liste: lignes, videTexte, colonneTemps = "Depuis" }) {
    const replie = replies[cle];
    return (
      <section key={cle} id={`section-${cle}`} className="mb-8 scroll-mt-24">
        <SectionTitle
          icone={icone}
          titre={titre}
          compteur={lignes.length}
          ton={lignes.length ? ton : "neutral"}
          onClick={() => setReplies((r) => ({ ...r, [cle]: !r[cle] }))}
          replie={replie}
        />
        {!replie && (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Ingénieur</th>
                  <th>Fiche</th>
                  <th>Statut</th>
                  <th>{colonneTemps}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {lignes.slice(0, 200).map((d) => {
                  const h = heuresDansEtape(d);
                  const urgence = h !== null && h >= seuilUrgence && d.etat !== S.VALIDE;
                  const ouvert = dossierActif === d.id;
                  return (
                    <Fragment key={d.id}>
                      <tr className={`${ouvert ? "bg-brand-50/60" : urgence ? "bg-isoRed-light/40" : "hover:bg-brand-50/30"}`}>
                        <td>
                          <span className="font-semibold flex items-center gap-1.5 flex-wrap">
                            {d.prioritaire && (
                              <span title="Prioritaire" className="text-isoRed">
                                <Icon name="flame" size={15} />
                              </span>
                            )}
                            {d.nom_dossier}
                            {d.a_corriger && <span className="badge badge-red">À corriger</span>}
                            {d.nb_retours >= 2 && <span className="badge badge-red">{d.nb_retours} retours</span>}
                          </span>
                          {d.beneficiaire_nom && <span className="block text-xs text-ink/50">{d.beneficiaire_nom}</span>}
                        </td>
                        <td>
                          {d.ingenieur ? (
                            <span className="flex items-center gap-2 capitalize whitespace-nowrap">
                              <Avatar nom={d.ingenieur} taille={22} />
                              {d.ingenieur}
                            </span>
                          ) : (
                            <span className="text-ink/35">—</span>
                          )}
                          {d.hors_habilitation && <span className="block text-[11px] text-isoGold-dark">hors fiche habituelle</span>}
                        </td>
                        <td className="text-ink/70 whitespace-nowrap">{d.nom_operation}</td>
                        <td>
                          <StatutBadge etat={d.etat} />
                          {d.valide_par && d.etat === S.VALIDE && <p className="text-[11px] text-ink/45 mt-1 capitalize">par {d.valide_par}</p>}
                        </td>
                        <td>
                          {d.etat === S.VALIDE ? (
                            <span className="text-xs text-ink/55 tabular">
                              {d.date_verification ? new Date(d.date_verification).toLocaleDateString("fr-FR") : "—"}
                            </span>
                          ) : h !== null ? (
                            <span className={`badge tabular ${classeTemps(h, d.etat)}`}>{formatDuree(h)}</span>
                          ) : (
                            <span className="text-ink/25">—</span>
                          )}
                        </td>
                        <td>
                          <div className="flex gap-1.5 justify-end">
                            <button className="btn-ghost btn-xs" onClick={() => setDossierHistorique(d)} title="Historique">
                              <Icon name="history" size={14} />
                            </button>
                            <button
                              className={ouvert ? "btn-primary btn-xs" : "btn-secondary btn-xs"}
                              onClick={() => (ouvert ? fermerPanneau() : (fermerPanneau(), setDossierActif(d.id)))}
                              aria-expanded={ouvert}
                            >
                              Traiter
                              <Icon name="chevronDown" size={13} className={ouvert ? "rotate-180" : ""} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {ouvert && (
                        <tr>
                          <td colSpan={6} className="bg-paper/70 !py-0">
                            {panneauAction(d)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">{videTexte}</td>
                  </tr>
                )}
                {lignes.length > 200 && (
                  <tr>
                    <td colSpan={6} className="text-center text-xs text-ink/45 py-3">
                      200 premiers affichés sur {lignes.length} — affine avec la recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  const etapes = [
    { cle: "file", label: "Dans la file", total: file.length, icone: "inbox", ton: "neutral" },
    { cle: "assignes", label: "Assignés", total: assignes.length, icone: "user", ton: "neutral" },
    { cle: "enCours", label: "En cours", total: enCours.length, icone: "pencil", ton: "brand" },
    { cle: "attenteInfo", label: "Attente d'info", total: attenteInfo.length, icone: "clock", ton: "gold" },
    { cle: "aControler", label: "À contrôler", total: aControler.length, icone: "shield", ton: "gold" },
    { cle: "valides", label: "Validés", total: valides.length, icone: "checkCircle", ton: "green" },
  ];
  const TON_ETAPE = {
    neutral: "bg-ink/[0.05] text-ink/60",
    gold: "bg-isoGold-light text-isoGold-dark",
    brand: "bg-brand-50 text-brand-600",
    green: "bg-isoGreen-light text-isoGreen-dark",
  };

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="shield"
          titre="Qualité"
          sousTitre="Dispatch, suivi et contrôle des dossiers."
          actions={
            <span className="badge badge-gold h-8 px-3 text-xs">
              <Icon name="target" size={13} />
              Contrôle sous {seuilHeures} h après « Terminé »
            </span>
          }
        />

        <div className="card p-2 mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-1">
          {etapes.map((e) => (
            <button
              key={e.cle}
              onClick={() => {
                setReplies((r) => ({ ...r, [e.cle]: false }));
                setTimeout(() => document.getElementById(`section-${e.cle}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              }}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left hover:bg-paper transition-colors"
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${TON_ETAPE[e.ton]}`}>
                <Icon name={e.icone} size={17} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-xl font-extrabold tabular leading-none">{e.total}</span>
                <span className="block text-xs text-ink/55 mt-1 truncate">{e.label}</span>
              </span>
            </button>
          ))}
        </div>

        <div className="relative mb-6 max-w-md">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Filtrer par dossier, bénéficiaire, adresse, téléphone, ingénieur…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {tableau({ cle: "aControler", titre: "À contrôler", icone: "shield", ton: "gold", liste: aControler, videTexte: "Rien à contrôler pour l'instant.", colonneTemps: "Attend depuis" })}
        {tableau({ cle: "file", titre: "Dans la file", icone: "inbox", ton: "neutral", liste: file, videTexte: "La file est vide.", colonneTemps: "Dans la file depuis" })}
        {tableau({ cle: "assignes", titre: "Assignés, pas encore commencés", icone: "user", ton: "neutral", liste: assignes, videTexte: "Aucun dossier en attente chez un ingénieur." })}
        {tableau({ cle: "enCours", titre: "En cours chez les ingénieurs", icone: "pencil", ton: "brand", liste: enCours, videTexte: "Aucun dossier en cours." })}
        {tableau({ cle: "attenteInfo", titre: "En attente d'info (bloqués)", icone: "clock", ton: "gold", liste: attenteInfo, videTexte: "Aucun dossier bloqué." })}
        {tableau({ cle: "valides", titre: "Validés", icone: "checkCircle", ton: "green", liste: valides, videTexte: "Aucun dossier validé.", colonneTemps: "Validé le" })}
        {tableau({ cle: "autres", titre: "Mis de côté (suspendus, en pause, annulés)", icone: "layers", ton: "neutral", liste: autres, videTexte: "Aucun dossier mis de côté." })}
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
