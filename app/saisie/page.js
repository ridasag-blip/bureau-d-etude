"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import DossierFormSaisie from "@/components/DossierFormSaisie";
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
import { enregistrerEvenement, annulerAction, instantane } from "@/lib/actions";
import { S, formatDate, formatDuree } from "@/lib/constants";
import FicheBeneficiaire from "@/components/FicheBeneficiaire";
import ImportDossiers, { exporterFile } from "@/components/ImportDossiers";
import { BadgeRetour } from "@/components/DossierTable";
import UndoToast from "@/components/ui/UndoToast";
import { attribuerAutomatiquement } from "@/lib/dispatch";
import EditionDossier from "@/components/EditionDossier";
import FichiersDossier from "@/components/FichiersDossier";
import CelluleFichiers, { useFichiers } from "@/components/CelluleFichiers";

export default function SaisiePage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs, verifier } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;
  const nomTrace = estAdmin ? null : nomActif;
  const [dossiers, setDossiers] = useState([]);
  const [limite, setLimite] = useState(50);
  const [dossierOuvert, setDossierOuvert] = useState(null);
  const [commentaires, setCommentaires] = useState([]);
  const [evenements, setEvenements] = useState([]);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [importOuvert, setImportOuvert] = useState(false);
  const [edition, setEdition] = useState(false);

  const [file, setFile] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [assignation, setAssignation] = useState({}); // { [dossierId]: ingénieur choisi }
  const [derniereAction, setDerniereAction] = useState(null);
  const [message, setMessage] = useState(null);
  const fichiers = useFichiers(supabase, !!profile);
  const celluleFichiers = (d) => (
    <td onClick={(e) => e.stopPropagation()}>
      <CelluleFichiers
        supabase={supabase}
        dossier={d}
        fichiers={fichiers.parDossier[d.id]}
        auteur={nomActif}
        onChange={fichiers.recharger}
        desactive={fichiers.indisponible}
      />
    </td>
  );

  async function chargerDossiers() {
    const [{ data: f }, { data: autres }] = await Promise.all([
      supabase.from("dossiers").select("*").eq("etat", S.FILE).limit(5000),
      supabase
        .from("dossiers")
        .select("*")
        .neq("etat", S.FILE)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    setFile(
      (f || []).sort(
        (a, b) =>
          (b.prioritaire ? 1 : 0) - (a.prioritaire ? 1 : 0) ||
          String(a.date_mise_en_file || a.created_at).localeCompare(String(b.date_mise_en_file || b.created_at))
      )
    );
    setDossiers(autres || []);
  }

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

  async function assignerManuel(d) {
    const ing = assignation[d.id];
    if (!ing) return;
    const horsHab = !(options.habilitations?.[ing] || []).includes(d.nom_operation);
    const { error } = await supabase
      .from("dossiers")
      .update({ etat: S.ASSIGNE, ingenieur: ing, date_assignation: new Date().toISOString(), hors_habilitation: horsHab })
      .eq("id", d.id);
    if (error) return alert("Attribution impossible : " + error.message);
    const evt = await enregistrerEvenement(supabase, d.id, "assignation", {
      nom: nomTrace,
      cause: `→ ${ing}${horsHab ? " (hors fiche habituelle)" : ""}`,
    });
    memoriser(d, `Attribué à ${ing}`, evt);
    setAssignation((a) => ({ ...a, [d.id]: "" }));
    chargerDossiers();
  }

  async function attribuerAuto(d) {
    const r = await attribuerAutomatiquement(supabase, d, options, nomTrace);
    if (!r.ok) {
      setMessage({ ton: "red", texte: r.erreur });
      return;
    }
    memoriser(d, `Attribué automatiquement à ${r.ingenieur}`, r.evenementId);
    setMessage({ ton: "green", texte: `« ${d.nom_dossier} » → ${r.ingenieur} : ${r.raison}.` });
    chargerDossiers();
  }

  useEffect(() => {
    if (!profile) return;
    chargerDossiers();
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

    const dansLaFile = form.mode === "file";
    const maintenant = new Date().toISOString();
    const payload = {
      date: form.date,
      nom_dossier: form.nom_dossier.trim(),
      nom_operation: form.nom_operation,
      client: form.client || null,
      nature_prod: form.nature_prod,
      commentaire: form.commentaire || null,
      beneficiaire_nom: form.beneficiaire_nom.trim() || null,
      beneficiaire_siret: form.beneficiaire_siret.replace(/\s/g, "") || null,
      beneficiaire_responsable: form.beneficiaire_responsable.trim() || null,
      beneficiaire_adresse: form.beneficiaire_adresse.trim() || null,
      beneficiaire_email: form.beneficiaire_email.trim() || null,
      beneficiaire_telephone: form.beneficiaire_telephone.trim() || null,
      prioritaire: form.prioritaire,
      ingenieur: dansLaFile ? null : form.ingenieur,
      hors_habilitation: dansLaFile ? false : form.hors_habilitation,
      etat: dansLaFile ? S.FILE : S.ASSIGNE,
      date_mise_en_file: dansLaFile ? maintenant : null,
      date_assignation: dansLaFile ? null : maintenant,
      created_by: user.id,
    };

    const { data, error } = await supabase.from("dossiers").insert(payload).select().single();
    if (error) {
      alert("Erreur à l'enregistrement : " + error.message);
      return;
    }

    await enregistrerEvenement(supabase, data.id, dansLaFile ? "mise_en_file" : "assignation", {
      nom: nomTrace,
      cause: dansLaFile ? null : `→ ${form.ingenieur}${form.hors_habilitation ? " (hors fiche habituelle)" : ""}`,
    });

    chargerDossiers();
    setFormulaireOuvert(false);
  }

  async function majDossier(champs) {
    const { error } = await supabase.from("dossiers").update(champs).eq("id", dossierOuvert.id);
    if (error) return error.message;
    setDossierOuvert((d) => ({ ...d, ...champs }));
    setEdition(false);
    chargerDossiers();
    return null;
  }

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner, verifier });
  if (ecran) return ecran;

  const charge = calculerCharge(dossiers);
  const occupes = new Set(dossiers.filter((d) => d.etat === S.EN_COURS).map((d) => d.ingenieur));
  const q = recherche.trim().toLowerCase();
  const autres = dossiers.filter(
    (d) =>
      !q ||
      [d.nom_dossier, d.beneficiaire_nom, d.beneficiaire_adresse, d.ingenieur, d.nom_operation]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
  );

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-5 py-6">
        <PageHeader
          icone="pencil"
          titre="Saisie"
          sousTitre={
            <>
              Bonjour <span className="capitalize font-medium text-ink/80">{nomActif}</span> — alimente la file d'attente et
              suis tous les dossiers.
            </>
          }
          actions={
            <button onClick={() => setFormulaireOuvert(true)} className="btn-primary">
              <Icon name="plus" size={16} />
              Nouveau dossier
            </button>
          }
        />

        <ObjectifJour supabase={supabase} operations={options.operations} />

        {/* ---------- Tableau 1 : file d'attente ---------- */}
        <section className="mb-10">
          <SectionTitle
            icone="inbox"
            titre="File d'attente — dossiers non attribués"
            compteur={file.length}
            ton={file.length ? "brand" : "neutral"}
            actions={
              <div className="flex gap-2">
                <button onClick={() => setImportOuvert(true)} className="btn-secondary btn-sm">
                  <Icon name="upload" size={14} />
                  Importer Excel
                </button>
                <button onClick={() => exporterFile(file)} className="btn-secondary btn-sm" disabled={!file.length}>
                  <Icon name="download" size={14} />
                  Exporter
                </button>
              </div>
            }
          />
          <p className="text-xs text-ink/50 mb-3">
            Distribués automatiquement : chaque ingénieur qui clique « Terminé → suivant » reçoit le premier dossier de ses
            fiches (prioritaires d'abord, puis les plus anciens).
          </p>

          {message && (
            <div className={`alert ${message.ton === "red" ? "alert-red" : "alert-green"} mb-3`}>
              <Icon name={message.ton === "red" ? "alert" : "checkCircle"} size={16} className="mt-0.5" />
              <span className="flex-1">{message.texte}</span>
              <button onClick={() => setMessage(null)} className="opacity-60 hover:opacity-100" aria-label="Fermer">
                <Icon name="x" size={14} />
              </button>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Fiche</th>
                  <th>Nature</th>
                  <th>Dans la file depuis</th>
                  <th className="!text-right">Fichiers</th>
                  <th className="!text-right">Attribuer</th>
                </tr>
              </thead>
              <tbody>
                {file.map((d) => (
                  <tr key={d.id} className="hover:bg-brand-50/30">
                    <td className="cursor-pointer" onClick={() => ouvrirDossier(d)}>
                      <span className="font-semibold flex items-center gap-1.5">
                        {d.prioritaire && <Icon name="flame" size={14} className="text-isoRed" />}
                        {d.nom_dossier}
                      </span>
                      {d.beneficiaire_nom && <span className="block text-xs text-ink/50">{d.beneficiaire_nom}</span>}
                    </td>
                    <td className="text-ink/70 whitespace-nowrap">{d.nom_operation}</td>
                    <td className="text-ink/60">{d.nature_prod || "—"}</td>
                    <td className="text-ink/60 tabular whitespace-nowrap">
                      {formatDuree((Date.now() - new Date(d.date_mise_en_file || d.created_at).getTime()) / 3600000)}
                    </td>
                    {celluleFichiers(d)}
                    <td>
                      <div className="flex items-center justify-end gap-1.5">
                        <button className="btn-secondary btn-xs" onClick={() => attribuerAuto(d)} title="À l'ingénieur le plus disponible">
                          <Icon name="users" size={13} />
                          Auto
                        </button>
                        <select
                          className="input input-sm w-44"
                          value={assignation[d.id] || ""}
                          onChange={(e) => setAssignation((a) => ({ ...a, [d.id]: e.target.value }))}
                        >
                          <option value="">Choisir un ingénieur…</option>
                          {options.ingenieurs.map((i) => (
                            <option key={i} value={i}>
                              {i}
                              {occupes.has(i) ? " · occupé" : " · libre"}
                              {!(options.habilitations?.[i] || []).includes(d.nom_operation) ? " · hors fiche" : ""}
                            </option>
                          ))}
                        </select>
                        <button className="btn-primary btn-xs" disabled={!assignation[d.id]} onClick={() => assignerManuel(d)}>
                          Assigner
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {file.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      La file est vide. Ajoute des dossiers avec « Nouveau dossier » ou « Importer Excel ».
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ---------- Tableau 2 : dossiers en cours (tous sauf la file) ---------- */}
        <section>
          <SectionTitle
            icone="list"
            titre="Dossiers en cours"
            compteur={dossiers.length}
            actions={
              <div className="relative w-64">
                <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none" />
                <input
                  className="input input-sm pl-8"
                  placeholder="Rechercher…"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                />
              </div>
            }
          />
          <div className="card overflow-x-auto">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Dossier</th>
                  <th>Ingénieur</th>
                  <th>Fiche</th>
                  <th>Retours</th>
                  <th>Statut</th>
                  <th className="!text-right">Fichiers</th>
                </tr>
              </thead>
              <tbody>
                {autres.slice(0, limite).map((d) => (
                  <tr key={d.id} className="cursor-pointer" onClick={() => ouvrirDossier(d)}>
                    <td className="whitespace-nowrap text-ink/60 tabular">{formatDate(d.date)}</td>
                    <td>
                      <span className="font-semibold flex items-center gap-1.5">
                        {d.prioritaire && <Icon name="flame" size={13} className="text-isoRed" />}
                        {d.nom_dossier}
                      </span>
                      {d.beneficiaire_nom && <span className="block text-xs text-ink/50">{d.beneficiaire_nom}</span>}
                    </td>
                    <td className="capitalize">{d.ingenieur || "—"}</td>
                    <td className="text-ink/70 whitespace-nowrap">{d.nom_operation}</td>
                    <td>
                      <BadgeRetour dossier={d} />
                    </td>
                    <td>
                      <StatutBadge etat={d.etat} />
                    </td>
                    {celluleFichiers(d)}
                  </tr>
                ))}
                {autres.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">
                      Aucun dossier.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {autres.length > limite && (
            <div className="flex justify-center mt-4">
              <button className="btn-secondary" onClick={() => setLimite((l) => l + 50)}>
                Afficher plus ({autres.length - limite} restants)
              </button>
            </div>
          )}
          {dossiers.length >= 500 && (
            <p className="text-xs text-ink/45 mt-2">Les 500 derniers dossiers sont affichés. L'historique complet est dans Export.</p>
          )}
        </section>
      </main>

      {formulaireOuvert && (
        <Modal titre="Nouveau dossier" sousTitre="Saisie — dispatching" onFermer={() => setFormulaireOuvert(false)} taille="lg">
          <DossierFormSaisie
            options={options}
            dossiersExistants={[...file, ...dossiers]}
            chargeParIngenieur={charge}
            onSubmit={soumettreDossier}
            onAnnuler={() => setFormulaireOuvert(false)}
          />
        </Modal>
      )}

      {dossierOuvert && (
        <Modal
          titre={dossierOuvert.nom_dossier}
          sousTitre={`${dossierOuvert.ingenieur || "Dans la file"} · ${dossierOuvert.nom_operation || "—"}`}
          onFermer={() => {
            setDossierOuvert(null);
            setEdition(false);
          }}
          taille="lg"
        >
          {edition ? (
            <EditionDossier dossier={dossierOuvert} options={options} onSave={majDossier} onAnnuler={() => setEdition(false)} />
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between gap-3">
                <StatutBadge etat={dossierOuvert.etat} />
                <button className="btn-secondary btn-sm" onClick={() => setEdition(true)}>
                  <Icon name="pencil" size={14} />
                  Modifier les informations
                </button>
              </div>
              <p className="eyebrow mb-2">Bénéficiaire</p>
              <div className="mb-6">
                <FicheBeneficiaire key={dossierOuvert.id} dossier={dossierOuvert} />
              </div>
              <p className="eyebrow mb-2">Pièces jointes</p>
              <div className="mb-6">
                <FichiersDossier
                  key={"f" + dossierOuvert.id}
                  supabase={supabase}
                  dossier={dossierOuvert}
                  auteur={nomActif}
                  peutDeposerPieces
                  peutDeposerLivrables={false}
                  peutSupprimer
                  onChange={fichiers.recharger}
                />
              </div>
              <p className="eyebrow mb-3">Historique</p>
              <HistoriqueDossier evenements={evenements} />

              <p className="eyebrow mb-3 mt-6">Commentaires</p>
              <CommentThread commentaires={commentaires} onAjouter={ajouterCommentaire} auteurNom={nomActif} />
            </>
          )}
        </Modal>
      )}

      {importOuvert && (
        <ImportDossiers
          options={options}
          supabase={supabase}
          nomTrace={nomTrace}
          onFermer={() => setImportOuvert(false)}
          onTermine={chargerDossiers}
        />
      )}

      {derniereAction && (
        <UndoToast message={`${derniereAction.libelle} — « ${derniereAction.nomDossier} »`} onAnnuler={annulerDerniereAction} />
      )}
    </div>
  );
}
