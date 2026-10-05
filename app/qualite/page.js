"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Fragment } from "react";
import Navbar from "@/components/Navbar";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import FicheBeneficiaire from "@/components/FicheBeneficiaire";
import FichiersDossier from "@/components/FichiersDossier";
import CelluleFichiers, { useFichiers } from "@/components/CelluleFichiers";
import { exporterDossiers } from "@/lib/exportDossiers";
import { BadgeTypeRetour } from "@/components/DossierTable";
import PageHeader from "@/components/ui/PageHeader";
import StatutBadge from "@/components/ui/StatutBadge";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import UndoToast from "@/components/ui/UndoToast";
import { gardePage } from "@/components/ui/Screens";
import { useAppData } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import { formatDate, formatDuree, S, STATUTS_MANUELS } from "@/lib/constants";
import { couleurEtat } from "@/lib/couleurs";
import { enregistrerEvenement, annulerAction, instantane } from "@/lib/actions";
import { attribuerAutomatiquement } from "@/lib/dispatch";

const ETATS_CHARGES = [S.FILE, S.ASSIGNE, S.EN_COURS, S.ATTENTE_INFO, S.A_CONTROLER, S.VERIF, S.VALIDE, ...STATUTS_MANUELS];

/** Depuis quand le dossier est dans son étape actuelle (heures). */
function heuresDansEtape(d) {
  const ref = {
    [S.FILE]: d.date_mise_en_file || d.created_at,
    [S.ASSIGNE]: d.date_assignation || d.created_at,
    [S.EN_COURS]: d.date_acceptation,
    [S.A_CONTROLER]: d.date_soumission,
    [S.VERIF]: d.date_prise_en_charge || d.date_soumission,
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
  const [filtre, setFiltre] = useState("tous");
  const [operation, setOperation] = useState("toutes");
  const [limite, setLimite] = useState(150);
  const [exportEnCours, setExportEnCours] = useState(false);
  // Admin : « Audité par » doit être un nom de la liste des validateurs (contrainte en base)
  const [auditeurAdmin, setAuditeurAdmin] = useState("");
  useEffect(() => {
    try {
      setAuditeurAdmin(localStorage.getItem("hillsolution_auditeur_admin") || "");
    } catch {}
  }, []);
  function choisirAuditeur(nom) {
    setAuditeurAdmin(nom);
    try {
      localStorage.setItem("hillsolution_auditeur_admin", nom);
    } catch {}
  }
  const fichiers = useFichiers(supabase, !!profile);

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

  // Lien direct : /qualite?statut=aControler → ouvre la page filtrée
  useEffect(() => {
    try {
      const st = new URLSearchParams(window.location.search).get("statut");
      if (st) setFiltre(st);
    } catch {}
  }, []);

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

  async function attribuerAuto(d) {
    const r = await attribuerAutomatiquement(supabase, d, options, nomTrace);
    if (!r.ok) return alert(r.erreur);
    memoriser(d, `Attribué automatiquement à ${r.ingenieur}`, r.evenementId, null);
    fermerPanneau();
    chargerDossiers();
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

  const nomsValidateurs = (validateurs || []).map((v) => v.nom);
  const auditeur = estAdmin
    ? nomsValidateurs.includes(nomActif)
      ? nomActif
      : nomsValidateurs.includes(auditeurAdmin)
      ? auditeurAdmin
      : ""
    : nomActif;

  function valider(d) {
    if (!auditeur) return alert("Choisis d'abord « Audité par » (nom du validateur).");
    return appliquer(
      d,
      { etat: S.VALIDE, date_verification: new Date().toISOString(), valide_par: auditeur, a_corriger: false },
      "Dossier audité",
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
      dernier_retour_type: client ? "client" : "interne",
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

  // « Je contrôle » : le dossier passe « En vérification Q » au nom de la personne
  async function prendreEnControle(d) {
    const { data: frais } = await supabase.from("dossiers").select("etat, pris_en_charge_par").eq("id", d.id).maybeSingle();
    if (frais && frais.etat !== S.A_CONTROLER) {
      alert(
        frais.etat === S.VERIF
          ? `Ce dossier est déjà en contrôle par ${frais.pris_en_charge_par || "une autre personne"}.`
          : "Ce dossier n'est plus à contrôler."
      );
      return chargerDossiers();
    }
    const ok = await appliquer(
      d,
      { etat: S.VERIF, pris_en_charge_par: nomActif || null, date_prise_en_charge: new Date().toISOString() },
      "Contrôle commencé",
      { type: "prise_en_charge" }
    );
    if (ok) setDossierActif(d.id);
  }

  function relacherControle(d) {
    return appliquer(d, { etat: S.A_CONTROLER, pris_en_charge_par: null, date_prise_en_charge: null }, "Remis à contrôler", null);
  }

  async function exporterTout() {
    setExportEnCours(true);
    const { data, error } = await supabase.from("dossiers").select("*").order("date", { ascending: false }).limit(20000);
    setExportEnCours(false);
    if (error) return alert("Export impossible : " + error.message);
    await exporterDossiers(data || [], "HILLSOLUTION_qualite");
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
    if (etat !== S.A_CONTROLER && etat !== S.VERIF) return h >= seuilUrgence ? "badge-red" : "badge-neutral";
    const ratio = h / seuilHeures;
    if (ratio >= 1) return "badge-red";
    if (ratio >= 0.6) return "badge-gold";
    return "badge-green";
  }

  const q = recherche.trim().toLowerCase();
  const correspond = (d) =>
    !q ||
    [d.nom_dossier, d.beneficiaire_nom, d.beneficiaire_adresse, d.beneficiaire_telephone, d.ingenieur, d.nom_operation]
      .filter(Boolean)
      .some((v) => v.toLowerCase().includes(q));

  // Filtres (pastilles), dans l'ordre du circuit
  const CHEZ_INGENIEUR = [S.FILE, S.ASSIGNE, S.EN_COURS, S.ATTENTE_INFO];
  const estRetour = (d) => d.a_corriger && CHEZ_INGENIEUR.includes(d.etat);
  const GROUPES = [
    { cle: "file", libelle: "En file", couleur: couleurEtat(S.FILE), test: (d) => d.etat === S.FILE && !estRetour(d) },
    {
      cle: "production",
      libelle: "En production",
      couleur: couleurEtat(S.EN_COURS),
      test: (d) => [S.ASSIGNE, S.EN_COURS, S.ATTENTE_INFO].includes(d.etat) && !estRetour(d),
    },
    { cle: "aControler", libelle: "À contrôler", couleur: couleurEtat(S.A_CONTROLER), test: (d) => d.etat === S.A_CONTROLER },
    { cle: "verification", libelle: "En vérification Q", couleur: couleurEtat(S.VERIF), test: (d) => d.etat === S.VERIF },
    { cle: "retour", libelle: "Retour", couleur: "#C2410C", test: estRetour },
    { cle: "audites", libelle: "Audité", couleur: couleurEtat(S.VALIDE), test: (d) => [S.VALIDE, "Dossier vérifié"].includes(d.etat) },
    { cle: "cote", libelle: "Annulé / Suspendu", couleur: couleurEtat("Suspendue"), test: (d) => STATUTS_MANUELS.includes(d.etat) },
  ];
  const groupeActif = GROUPES.find((g) => g.cle === filtre);
  const parOperation = (d) => operation === "toutes" || d.nom_operation === operation;
  const parStatut = (d) => !groupeActif || groupeActif.test(d);
  GROUPES.forEach((g) => (g.total = dossiers.filter((d) => g.test(d) && parOperation(d)).length));
  const totalOperation = dossiers.filter(parOperation).length;
  // Filtre par opération (fiche CEE) : toutes les fiches paramétrées + celles présentes dans les dossiers
  const OPERATIONS = [...new Set([...(options.operations || []), ...dossiers.map((d) => d.nom_operation).filter(Boolean)])]
    .sort()
    .map((op) => ({ op, total: dossiers.filter((d) => d.nom_operation === op && parStatut(d)).length }));

  // Tableau unique, du dossier le plus récent au plus ancien
  const lignes = dossiers
    .filter((d) => parStatut(d) && parOperation(d))
    .filter(correspond)
    .sort(
      (a, b) =>
        String(b.date || "").localeCompare(String(a.date || "")) ||
        String(b.created_at || "").localeCompare(String(a.created_at || ""))
    );

  function panneauAction(d) {
    const peutAssigner = [S.FILE, S.ASSIGNE, S.ATTENTE_INFO].includes(d.etat) || STATUTS_MANUELS.includes(d.etat);
    const peutRetour = [S.A_CONTROLER, S.VERIF, S.VALIDE].includes(d.etat);
    return (
      <div className="grid lg:grid-cols-[1fr_1.2fr] gap-4 py-4">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Bénéficiaire</p>
          <FicheBeneficiaire key={d.id} dossier={d} onSave={(c) => majBeneficiaire(d, c)} compact />
          <p className="eyebrow mt-2">Pièces jointes</p>
          <FichiersDossier
            key={"f" + d.id}
            supabase={supabase}
            dossier={d}
            auteur={nomActif}
            peutDeposerPieces
            peutDeposerLivrables={false}
            peutSupprimer
            compact
            onChange={fichiers.recharger}
          />
          {d.motif_statut && (
            <p className="text-xs text-ink/60">
              <strong>Motif :</strong> {d.motif_statut}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <p className="eyebrow">Actions</p>
          <div className="flex flex-wrap items-center gap-2">
            {d.etat === S.A_CONTROLER && (
              <button onClick={() => prendreEnControle(d)} className="btn-primary btn-sm" title="Le dossier passe « En vérification Q » à ton nom">
                <Icon name="shield" size={14} />
                Je contrôle
              </button>
            )}
            {d.etat === S.VERIF && (
              <span className="badge badge-brand h-8 px-3">
                <Icon name="shield" size={13} />
                En contrôle par <span className="capitalize">{d.pris_en_charge_par || "—"}</span>
              </span>
            )}
            {(d.etat === S.A_CONTROLER || d.etat === S.VERIF) && (
              <>
                {estAdmin && !nomsValidateurs.includes(nomActif) && (
                  <select
                    className={`input input-sm w-44 ${auditeur ? "" : "border-isoRed/60"}`}
                    value={auditeur}
                    onChange={(e) => choisirAuditeur(e.target.value)}
                    aria-label="Audité par"
                    title="Nom enregistré comme « Audité par »"
                  >
                    <option value="">Audité par…</option>
                    {nomsValidateurs.map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                )}
                <button onClick={() => valider(d)} className="btn-success btn-sm" disabled={!auditeur}>
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
            {d.etat === S.VERIF && (
              <button onClick={() => relacherControle(d)} className="btn-ghost btn-sm" title="Le dossier repasse « À contrôler »">
                Remettre à contrôler
              </button>
            )}
            {d.etat === S.FILE && (
              <button onClick={() => attribuerAuto(d)} className="btn-primary btn-sm" title="À l'ingénieur habilité le plus disponible">
                <Icon name="users" size={14} />
                Attribuer automatiquement
              </button>
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

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-5 py-6">
        <PageHeader
          icone="shield"
          titre="Qualité"
          sousTitre="Tous les dossiers, du plus récent au plus ancien — clique sur « Traiter » pour agir."
          actions={
            <>
              <span className="badge badge-gold h-8 px-3 text-xs">
                <Icon name="target" size={13} />
                Contrôle sous {seuilHeures} h après « Terminé »
              </span>
              <button className="btn-secondary btn-sm" onClick={exporterTout} disabled={exportEnCours}>
                <Icon name="download" size={14} />
                {exportEnCours ? "Export…" : "Exporter"}
              </button>
            </>
          }
        />

        {/* Filtres par statut */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFiltre("tous")}
            className={`chip ${filtre === "tous" ? "chip-active" : ""}`}
            aria-pressed={filtre === "tous"}
          >
            Tous
            <span className="tabular opacity-70">{totalOperation}</span>
          </button>
          {GROUPES.map((g) => {
            const actif = filtre === g.cle;
            const c = g.couleur;
            return (
              <button
                key={g.cle}
                onClick={() => setFiltre(actif ? "tous" : g.cle)}
                aria-pressed={actif}
                className="chip"
                style={actif ? { background: c, borderColor: c, color: "#fff" } : undefined}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: actif ? "#fff" : c }} />
                {g.libelle}
                <span className="tabular opacity-70">{g.total}</span>
              </button>
            );
          })}
        </div>

        {/* Filtre par opération */}
        <div className="flex flex-wrap items-center gap-1.5 mb-4">
          <span className="text-xs font-semibold text-ink/45 uppercase tracking-wider mr-1">Opération</span>
          <button
            onClick={() => setOperation("toutes")}
            className={`chip !py-1 !text-xs ${operation === "toutes" ? "chip-active" : ""}`}
            aria-pressed={operation === "toutes"}
          >
            Toutes
          </button>
          {OPERATIONS.map(({ op, total }) => {
            const actif = operation === op;
            return (
              <button
                key={op}
                onClick={() => setOperation(actif ? "toutes" : op)}
                aria-pressed={actif}
                className={`chip !py-1 !text-xs ${actif ? "chip-active" : ""} ${total === 0 && !actif ? "opacity-50" : ""}`}
              >
                {op}
                <span className="tabular opacity-70">{total}</span>
              </button>
            );
          })}
        </div>

        <div className="relative mb-4 max-w-md">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Rechercher : dossier, bénéficiaire, adresse, téléphone, ingénieur, fiche…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Dossier</th>
                <th>Ingénieur</th>
                <th>Fiche</th>
                <th>Depuis</th>
                <th>Statut</th>
                <th className="!text-right">Fichiers</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lignes.slice(0, limite).map((d) => {
                const h = heuresDansEtape(d);
                const urgence = h !== null && h >= seuilUrgence && ![S.VALIDE, ...STATUTS_MANUELS].includes(d.etat);
                const ouvert = dossierActif === d.id;
                return (
                  <Fragment key={d.id}>
                    <tr className={`${ouvert ? "bg-brand-50/60" : urgence ? "bg-isoRed-light/40" : "hover:bg-brand-50/30"}`}>
                      <td className="whitespace-nowrap text-ink/60 tabular">{formatDate(d.date)}</td>
                      <td>
                        <span className="font-semibold flex items-center gap-1.5 flex-wrap">
                          {d.prioritaire && (
                            <span title="Prioritaire" className="text-isoRed">
                              <Icon name="flame" size={15} />
                            </span>
                          )}
                          {d.nom_dossier}
                          <BadgeTypeRetour dossier={d} />
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
                        {h !== null && ![S.VALIDE, ...STATUTS_MANUELS].includes(d.etat) ? (
                          <span className={`badge tabular ${classeTemps(h, d.etat)}`}>{formatDuree(h)}</span>
                        ) : (
                          <span className="text-ink/25">—</span>
                        )}
                      </td>
                      <td>
                        <StatutBadge etat={d.etat} />
                        {d.valide_par && d.etat === S.VALIDE && <p className="text-[11px] text-ink/45 mt-1 capitalize">par {d.valide_par}</p>}
                        {d.etat === S.VERIF && d.pris_en_charge_par && (
                          <p className="text-[11px] text-ink/45 mt-1 capitalize">par {d.pris_en_charge_par}</p>
                        )}
                      </td>
                      <td>
                        <CelluleFichiers
                          supabase={supabase}
                          dossier={d}
                          fichiers={fichiers.parDossier[d.id]}
                          auteur={nomActif}
                          onChange={fichiers.recharger}
                          desactive={fichiers.indisponible}
                          sansInserer
                        />
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
                        <td colSpan={8} className="bg-paper/70 !py-0">
                          {panneauAction(d)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-empty">
                    Aucun dossier pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {lignes.length > limite && (
          <div className="flex justify-center mt-4">
            <button className="btn-secondary" onClick={() => setLimite((l) => l + 150)}>
              Afficher plus ({lignes.length - limite} restants)
            </button>
          </div>
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
