"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState, Fragment } from "react";
import Navbar from "@/components/Navbar";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import PageHeader, { SectionTitle } from "@/components/ui/PageHeader";
import StatutBadge from "@/components/ui/StatutBadge";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import UndoToast from "@/components/ui/UndoToast";
import { gardePage } from "@/components/ui/Screens";
import { formatDuree } from "@/lib/constants";
import { useAppData } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";

const AIDE_PAR_ETAT = {
  "En attente de traitement":
    "Dossier assigné, en attente que l'ingénieur l'accepte. Rien à faire côté Qualité pour l'instant.",
  "Encours":
    "L'ingénieur travaille actuellement sur ce dossier. Il apparaîtra pour vérification une fois soumis.",
  "En attente de vérification":
    "Ce dossier attend d'être pris en charge par la Qualité, avant sa 1ère vérification.",
  "En cours de vérification":
    "Ce dossier n'est pas encore envoyé au client. Valide-le pour l'auditer, ou renvoie-le en interne si besoin de correction.",
  "Audité":
    "Dossier envoyé au client. S'il revient (faute interne découverte ou modification demandée), utilise les boutons ci-dessous.",
};

const STATUTS_MANUELS = ["Suspendue", "en pause", "Annulé", "Encours"];

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
  const [typeAction, setTypeAction] = useState(null);
  const [form, setForm] = useState({ cause: "", ingenieur_modif: "" });
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const [derniereAction, setDerniereAction] = useState(null);
  const [replies, setReplies] = useState({ autres: true }); // tableaux repliés (true = replié)

  async function chargerDossiers() {
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .in("etat", [
        "En attente de traitement",
        "Encours",
        "En attente de vérification",
        "En cours de vérification",
        "Audité",
        "Suspendue",
        "en pause",
        "Annulé",
      ])
      .order("date", { ascending: false })
      .limit(2000);
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

  async function enregistrerEvenement(dossierId, type, cause) {
    await supabase.from("dossier_evenements").insert({
      dossier_id: dossierId,
      type,
      cause: cause || null,
      effectue_par_nom: nomTrace,
    });
  }

  function memoriserPourAnnulation(d, libelle = "Action effectuée") {
    setDerniereAction({
      dossierId: d.id,
      nomDossier: d.nom_dossier,
      libelle,
      ancienChamps: {
        etat: d.etat,
        pris_en_charge_par: d.pris_en_charge_par,
        date_prise_en_charge: d.date_prise_en_charge,
        valide_par: d.valide_par,
        date_verification: d.date_verification,
        retour_interne: d.retour_interne,
        cause_retour_interne: d.cause_retour_interne,
        retour_client: d.retour_client,
        cause_retour_client: d.cause_retour_client,
        date_retour_client: d.date_retour_client,
        ingenieur_modif: d.ingenieur_modif,
        nb_retours: d.nb_retours,
      },
    });
    setTimeout(() => setDerniereAction((a) => (a?.dossierId === d.id ? null : a)), 8000);
  }

  async function annulerDerniereAction() {
    if (!derniereAction) return;
    await supabase.from("dossiers").update(derniereAction.ancienChamps).eq("id", derniereAction.dossierId);
    setDerniereAction(null);
    chargerDossiers();
  }

  async function prendreEnCharge(d) {
    memoriserPourAnnulation(d, "Pris en charge");
    await supabase
      .from("dossiers")
      .update({
        etat: "En cours de vérification",
        pris_en_charge_par: nomTrace,
        date_prise_en_charge: new Date().toISOString(),
      })
      .eq("id", d.id);
    await enregistrerEvenement(d.id, "prise_en_charge");
    chargerDossiers();
  }

  async function valider(d) {
    memoriserPourAnnulation(d, "Audit validé");
    await supabase
      .from("dossiers")
      .update({
        etat: "Audité",
        date_verification: new Date().toISOString(),
        valide_par: nomTrace,
      })
      .eq("id", d.id);
    await enregistrerEvenement(d.id, "verification_ok");
    setDossierActif(null);
    chargerDossiers();
  }

  async function enregistrerRetour(d) {
    if (!form.cause) return alert("Précise la cause.");
    memoriserPourAnnulation(d, "Retour enregistré");

    const avantAudit = d.etat !== "Audité";
    let payload;
    let evtType;

    if (typeAction === "retour_client") {
      payload = {
        retour_client: true,
        cause_retour_client: form.cause,
        date_retour_client: new Date().toISOString().slice(0, 10),
        ingenieur_modif: form.ingenieur_modif || null,
        etat: "Encours",
        date_verification: null,
        nb_retours: (d.nb_retours || 0) + 1,
      };
      evtType = "retour_client";
    } else {
      payload = {
        retour_interne: true,
        cause_retour_interne: form.cause,
        ingenieur_modif: form.ingenieur_modif || null,
        etat: "Encours",
        date_verification: avantAudit ? d.date_verification : null,
        nb_retours: (d.nb_retours || 0) + 1,
      };
      evtType = avantAudit ? "retour_interne_avant_audit" : "retour_interne_apres_audit";
    }

    const { error } = await supabase.from("dossiers").update(payload).eq("id", d.id);
    if (error) return alert("Erreur : " + error.message);

    await enregistrerEvenement(d.id, evtType, form.cause);
    setDossierActif(null);
    setTypeAction(null);
    setForm({ cause: "", ingenieur_modif: "" });
    chargerDossiers();
  }

  async function changerStatutManuel(d, nouveauStatut) {
    memoriserPourAnnulation(d, `Statut → ${nouveauStatut}`);
    await supabase.from("dossiers").update({ etat: nouveauStatut }).eq("id", d.id);
    await enregistrerEvenement(d.id, "changement_statut_manuel", `→ ${nouveauStatut}`);
    chargerDossiers();
  }

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner });
  if (ecran) return ecran;

  function heuresEnAttente(d) {
    if (!d.date_soumission) return null;
    return (Date.now() - new Date(d.date_soumission).getTime()) / 3600000;
  }

  function classeTemps(h) {
    if (h === null) return "badge-neutral";
    const ratio = h / seuilHeures;
    if (ratio >= 1) return "badge-red";
    if (ratio >= 0.6) return "badge-gold";
    return "badge-green";
  }

  const recherchee = (d) => d.nom_dossier?.toLowerCase().includes(recherche.toLowerCase());
  const parRecurrentDabord = (a, b) => (b.recurrent ? 1 : 0) - (a.recurrent ? 1 : 0);

  const nonSoumis = dossiers
    .filter((d) => ["En attente de traitement", "Encours"].includes(d.etat))
    .filter(recherchee)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const attenteQualite = dossiers
    .filter((d) => d.etat === "En attente de vérification")
    .filter(recherchee)
    .sort((a, b) => new Date(a.date_soumission || a.date) - new Date(b.date_soumission || b.date))
    .sort(parRecurrentDabord);

  const enCoursTraitement = dossiers
    .filter((d) => d.etat === "En cours de vérification")
    .filter(recherchee)
    .sort((a, b) => new Date(a.date_prise_en_charge || a.date) - new Date(b.date_prise_en_charge || b.date))
    .sort(parRecurrentDabord);

  const audite = dossiers
    .filter((d) => d.etat === "Audité")
    .filter(recherchee)
    .sort((a, b) => new Date(b.date_verification || b.date) - new Date(a.date_verification || a.date));

  const autresStatuts = dossiers
    .filter((d) => ["Suspendue", "en pause", "Annulé"].includes(d.etat))
    .filter(recherchee);

  function toggleReplie(cle) {
    setReplies((r) => ({ ...r, [cle]: !r[cle] }));
  }


  // NB : fonctions de rendu (et non composants déclarés dans le rendu) pour éviter
  // le démontage/remontage des champs à chaque frappe (perte de focus).
  function panneauAction(d) {
    return (
      <div className="flex flex-col gap-3 py-4">
        {AIDE_PAR_ETAT[d.etat] && (
          <p className="alert alert-info">
            <Icon name="info" size={15} className="mt-0.5" />
            <span>{AIDE_PAR_ETAT[d.etat]}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {d.etat === "En attente de vérification" && (
            <button onClick={() => prendreEnCharge(d)} className="btn-primary btn-sm">
              <Icon name="shield" size={14} />
              Prendre en charge
            </button>
          )}

          {d.etat === "En cours de vérification" && (
            <>
              <button onClick={() => valider(d)} className="btn-success btn-sm">
                <Icon name="check" size={14} />
                Valider (Audité)
              </button>
              <button
                onClick={() => setTypeAction("retour_interne")}
                className={`btn-sm ${typeAction === "retour_interne" ? "btn bg-isoGold-light text-isoGold-dark border border-isoGold/40" : "btn-danger"}`}
              >
                <Icon name="undo" size={14} />
                Retour interne
              </button>
            </>
          )}

          {d.etat === "Audité" && (
            <div className="segmented">
              <button data-active={typeAction === "retour_interne"} onClick={() => setTypeAction("retour_interne")}>
                Faute interne
              </button>
              <button data-active={typeAction === "retour_client"} onClick={() => setTypeAction("retour_client")}>
                Modification client
              </button>
            </div>
          )}
        </div>

        {typeAction && (
          <div className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-end bg-isoRed-light/60 border border-isoRed/20 rounded-lg p-3">
            <div className="field">
              <label className="label">Cause du retour {typeAction === "retour_client" ? "client" : "interne"}</label>
              <select
                className="input"
                value={form.cause}
                onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}
              >
                <option value="">Choisir…</option>
                {(typeAction === "retour_client" ? options.causesClient : options.causesInterne)?.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="label">Réassigner à (optionnel)</label>
              <select
                className="input"
                value={form.ingenieur_modif}
                onChange={(e) => setForm((f) => ({ ...f, ingenieur_modif: e.target.value }))}
              >
                <option value="">Même ingénieur</option>
                {options.ingenieurs?.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
              </select>
            </div>
            <button onClick={() => enregistrerRetour(d)} className="btn-primary">
              Enregistrer le retour
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 pt-3 border-t border-line">
          <span className="text-xs text-ink/45">Forcer un statut :</span>
          <select
            className="input input-sm w-40"
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) changerStatutManuel(d, e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">—</option>
            {STATUTS_MANUELS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
    );
  }

  function tableau({ cle, titre, icone, ton, liste, videTexte }) {
    const replie = replies[cle];
    return (
      <section key={cle} className="mb-8">
        <SectionTitle
          icone={icone}
          titre={titre}
          compteur={liste.length}
          ton={liste.length ? ton : "neutral"}
          onClick={() => toggleReplie(cle)}
          replie={replie}
        />
        {!replie && (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Dossier</th>
                  <th>Ingénieur</th>
                  <th>Opération</th>
                  <th>Client</th>
                  <th>Statut</th>
                  <th>Temps</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {liste.map((d) => {
                  const h = heuresEnAttente(d);
                  const urgence = h !== null && h >= seuilUrgence;
                  const ouvert = dossierActif === d.id;
                  return (
                    <Fragment key={d.id}>
                      <tr className={`${urgence ? "bg-isoRed-light/50" : ""} ${ouvert ? "bg-brand-50/60" : "hover:bg-brand-50/30"}`}>
                        <td className="font-semibold">
                          <span className="flex items-center gap-1.5">
                            {urgence && (
                              <span title={`Plus de ${seuilUrgence}h sans vérification`} className="text-isoRed">
                                <Icon name="flame" size={15} />
                              </span>
                            )}
                            {d.nom_dossier}
                            {d.recurrent && (
                              <span className="badge badge-red" title="Dossier récurrent">
                                <Icon name="alert" size={11} />
                                Récurrent
                              </span>
                            )}
                          </span>
                        </td>
                        <td>
                          <span className="flex items-center gap-2 capitalize whitespace-nowrap">
                            <Avatar nom={d.ingenieur} taille={22} />
                            {d.ingenieur}
                          </span>
                        </td>
                        <td className="text-ink/70">{d.nom_operation}</td>
                        <td className="text-ink/70">{d.client || "—"}</td>
                        <td>
                          <StatutBadge etat={d.etat} />
                          {d.pris_en_charge_par && (
                            <p className="text-[11px] text-ink/45 mt-1 capitalize">par {d.pris_en_charge_par}</p>
                          )}
                        </td>
                        <td>
                          {h !== null ? <span className={`badge tabular ${classeTemps(h)}`}>{formatDuree(h)}</span> : <span className="text-ink/25">—</span>}
                        </td>
                        <td>
                          <div className="flex gap-1.5 justify-end">
                            {d.nb_retours > 0 && (
                              <button
                                className="btn-ghost btn-xs"
                                onClick={() => setDossierHistorique(d)}
                                title="Voir l'historique"
                              >
                                <Icon name="history" size={14} />
                                <span className="hidden xl:inline">Historique</span>
                              </button>
                            )}
                            <button
                              className={ouvert ? "btn-primary btn-xs" : "btn-secondary btn-xs"}
                              onClick={() => {
                                setDossierActif(ouvert ? null : d.id);
                                setTypeAction(null);
                              }}
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
                          <td colSpan={7} className="bg-paper/70 !py-0">
                            {panneauAction(d)}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
                {liste.length === 0 && (
                  <tr>
                    <td colSpan={7} className="table-empty">{videTexte}</td>
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
    { cle: "nonSoumis", label: "Pas soumis", total: nonSoumis.length, icone: "users", ton: "neutral" },
    { cle: "attenteQualite", label: "Attente Qualité", total: attenteQualite.length, icone: "inbox", ton: "gold" },
    { cle: "enCoursTraitement", label: "En vérification", total: enCoursTraitement.length, icone: "shield", ton: "brand" },
    { cle: "audite", label: "Audité", total: audite.length, icone: "checkCircle", ton: "green" },
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
          sousTitre="Pipeline de production, étape par étape."
          actions={
            <span className="badge badge-gold h-8 px-3 text-xs">
              <Icon name="target" size={13} />
              Objectif : vérification sous {seuilHeures} h après soumission
            </span>
          }
        />

        {/* Pipeline */}
        <div className="card p-2 mb-6 grid grid-cols-2 md:grid-cols-4 gap-2">
          {etapes.map((e, i) => (
            <button
              key={e.cle}
              onClick={() => {
                setReplies((r) => ({ ...r, [e.cle]: false }));
                document.getElementById(`section-${e.cle}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className="relative flex items-center gap-3 rounded-lg px-3 py-3 text-left hover:bg-paper transition-colors"
            >
              <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${TON_ETAPE[e.ton]}`}>
                <Icon name={e.icone} size={18} />
              </span>
              <span>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-ink/45">
                  Étape {i + 1}
                </span>
                <span className="block text-sm font-semibold">{e.label}</span>
              </span>
              <span className="ml-auto font-display text-2xl font-extrabold tabular">{e.total}</span>
              {i < etapes.length - 1 && (
                <Icon name="chevronRight" size={16} className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 text-ink/20" />
              )}
            </button>
          ))}
        </div>

        <div className="relative mb-6 max-w-sm">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none" />
          <input
            className="input pl-9"
            placeholder="Filtrer les tableaux par nom de dossier…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        {[
          { cle: "nonSoumis", titre: "Pas encore soumis par l'ingénieur", icone: "users", ton: "neutral", liste: nonSoumis, videTexte: "Rien ici — tout a été soumis." },
          { cle: "attenteQualite", titre: "À prendre en charge par la Qualité", icone: "inbox", ton: "gold", liste: attenteQualite, videTexte: "Rien à vérifier pour l'instant." },
          { cle: "enCoursTraitement", titre: "En cours de vérification", icone: "shield", ton: "brand", liste: enCoursTraitement, videTexte: "Personne n'a de dossier en cours." },
          { cle: "audite", titre: "Audité", icone: "checkCircle", ton: "green", liste: audite, videTexte: "Rien d'audité pour l'instant." },
          { cle: "autres", titre: "Autres statuts (Suspendue / En pause / Annulé)", icone: "layers", ton: "neutral", liste: autresStatuts, videTexte: "Aucun dossier dans ces statuts." },
        ].map((t) => (
          <div key={t.cle} id={`section-${t.cle}`} className="scroll-mt-24">
            {tableau(t)}
          </div>
        ))}
      </main>

      {dossierHistorique && (
        <HistoriqueComplet supabase={supabase} dossier={dossierHistorique} onFermer={() => setDossierHistorique(null)} />
      )}

      {derniereAction && (
        <UndoToast
          message={`${derniereAction.libelle} — « ${derniereAction.nomDossier} »`}
          onAnnuler={annulerDerniereAction}
        />
      )}
    </div>
  );
}
