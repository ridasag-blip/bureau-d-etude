"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SelectionPersonne from "@/components/SelectionPersonne";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import { useAppData } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";

const FILTRES_STATUT = [
  { key: "tous", label: "Tous", etats: null },
  { key: "non_soumis", label: "Pas encore soumis", etats: ["En attente de traitement", "Encours"] },
  { key: "a_verifier", label: "À vérifier", etats: ["En attente de vérification"] },
  { key: "en_cours_verif", label: "En cours de vérif.", etats: ["En cours de vérification"] },
  { key: "audite", label: "Audité — Envoyé", etats: ["Audité"] },
];

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

function estAujourdHui(dateStr) {
  const d = new Date(dateStr);
  const auj = new Date();
  return (
    d.getFullYear() === auj.getFullYear() &&
    d.getMonth() === auj.getMonth() &&
    d.getDate() === auj.getDate()
  );
}

export default function QualitePage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;
  // Admin garde son accès mais son nom n'est jamais enregistré dans les
  // champs de traçabilité des dossiers (contrairement à la Qualité)
  const nomTrace = estAdmin ? null : nomActif;

  const [dossiers, setDossiers] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [seuilHeures, setSeuilHeures] = useState(1);
  const [seuilUrgence, setSeuilUrgence] = useState(24);
  const [dossierActif, setDossierActif] = useState(null);
  const [typeAction, setTypeAction] = useState(null);
  const [form, setForm] = useState({ cause: "", ingenieur_modif: "" });
  const [dossierHistorique, setDossierHistorique] = useState(null);
  const [derniereAction, setDerniereAction] = useState(null); // { dossierId, ancienEtat, ancienChamps }

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

  function memoriserPourAnnulation(d) {
    setDerniereAction({
      dossierId: d.id,
      nomDossier: d.nom_dossier,
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
    memoriserPourAnnulation(d);
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
    memoriserPourAnnulation(d);
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
    alert("Audit réalisé avec succès.");
  }

  async function enregistrerRetour(d) {
    if (!form.cause) return alert("Précise la cause.");
    memoriserPourAnnulation(d);

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
    memoriserPourAnnulation(d);
    await supabase.from("dossiers").update({ etat: nouveauStatut }).eq("id", d.id);
    await enregistrerEvenement(d.id, "changement_statut_manuel", `→ ${nouveauStatut}`);
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
  if (!estAdmin && !pretPersonne) return <div className="p-10 text-center text-ink/40">Chargement…</div>;

  if (!estAdmin && !nomActif) {
    return <SelectionPersonne personnes={validateurs} onSelection={selectionner} />;
  }

  function heuresEnAttente(d) {
    if (!d.date_soumission) return null;
    return (Date.now() - new Date(d.date_soumission).getTime()) / 3600000;
  }

  function classeTemps(h) {
    if (h === null) return "bg-black/5 text-ink/50";
    const ratio = h / seuilHeures;
    if (ratio >= 1) return "bg-isoRed/10 text-isoRed";
    if (ratio >= 0.6) return "bg-isoGold/10 text-isoGold";
    return "bg-isoGreen/10 text-isoGreen";
  }

  const filtreActuel = FILTRES_STATUT.find((f) => f.key === filtreStatut);
  const listeFiltree = dossiers
    .filter((d) => !filtreActuel.etats || filtreActuel.etats.includes(d.etat))
    .filter((d) => d.nom_dossier?.toLowerCase().includes(recherche.toLowerCase()))
    // Les dossiers récurrents remontent toujours en priorité, en haut de la liste
    .sort((a, b) => (b.recurrent ? 1 : 0) - (a.recurrent ? 1 : 0));

  const aujourdHui = listeFiltree.filter((d) => estAujourdHui(d.date));
  const anciens = listeFiltree.filter((d) => !estAujourdHui(d.date));

  function LigneDossier({ d }) {
    const h = heuresEnAttente(d);
    const urgence = h !== null && h >= seuilUrgence;
    return (
      <div className={`p-4 ${urgence ? "bg-isoRed/5" : ""}`}>
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium">
              {urgence && <span title={`Plus de ${seuilUrgence}h sans vérification`}>🔥 </span>}
              {d.nom_dossier}
              {d.recurrent && <span className="badge bg-isoRed/10 text-isoRed ml-2">⚠ Récurrent</span>}
            </p>
            <p className="text-xs text-ink/40">
              {d.date} · {d.ingenieur} · {d.nom_operation} · {d.client}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatutBadge etat={d.etat} />
            {h !== null && <span className={`badge ${classeTemps(h)}`}>{h.toFixed(1)}h</span>}
            {d.pris_en_charge_par && (
              <span className="text-xs text-ink/40">par {d.pris_en_charge_par}</span>
            )}
            {d.nb_retours > 0 && (
              <button
                className="btn-secondary !py-1 !px-3 text-xs"
                onClick={() => setDossierHistorique(d)}
              >
                Historique
              </button>
            )}
            <button
              className="btn-secondary !py-1 !px-3 text-xs"
              onClick={() => {
                setDossierActif(dossierActif === d.id ? null : d.id);
                setTypeAction(null);
              }}
            >
              Traiter
            </button>
          </div>
        </div>

        {dossierActif === d.id && (
          <div className="mt-4 pt-4 border-t flex flex-col gap-3">
            {AIDE_PAR_ETAT[d.etat] && (
              <p className="text-xs text-ink/50 bg-black/[0.03] rounded-md px-3 py-2">
                {AIDE_PAR_ETAT[d.etat]}
              </p>
            )}

            {d.etat === "En attente de vérification" && (
              <button onClick={() => prendreEnCharge(d)} className="btn-primary !py-1.5 text-sm self-start">
                Prendre en charge
              </button>
            )}

            {d.etat === "En cours de vérification" && (
              <div className="flex gap-3">
                <button onClick={() => valider(d)} className="btn-primary !py-1.5 text-sm">
                  ✓ Valider (Audité)
                </button>
                <button
                  onClick={() => setTypeAction("retour_interne")}
                  className="btn-secondary !py-1.5 text-sm border-isoRed text-isoRed"
                >
                  Retour interne
                </button>
              </div>
            )}

            {d.etat === "Audité" && (
              <div className="flex gap-2">
                <button
                  onClick={() => setTypeAction("retour_interne")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    typeAction === "retour_interne" ? "bg-isoGold text-white" : "bg-white border"
                  }`}
                >
                  Faute interne
                </button>
                <button
                  onClick={() => setTypeAction("retour_client")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    typeAction === "retour_client" ? "bg-isoRed text-white" : "bg-white border"
                  }`}
                >
                  Modification client
                </button>
              </div>
            )}

            {typeAction && (
              <div className="flex flex-col gap-2 bg-isoRed/5 border border-isoRed/20 rounded-md p-3">
                <select
                  className="border rounded-md px-2 py-1.5 text-sm"
                  value={form.cause}
                  onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}
                >
                  <option value="">Cause —</option>
                  {(typeAction === "retour_client" ? options.causesClient : options.causesInterne)?.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  className="border rounded-md px-2 py-1.5 text-sm"
                  value={form.ingenieur_modif}
                  onChange={(e) => setForm((f) => ({ ...f, ingenieur_modif: e.target.value }))}
                >
                  <option value="">Réassigner à (optionnel) —</option>
                  {options.ingenieurs?.map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
                <button
                  onClick={() => enregistrerRetour(d)}
                  className="btn-primary !py-1.5 text-sm self-start"
                >
                  Enregistrer le retour
                </button>
              </div>
            )}

            {/* Changement de statut manuel, disponible à tout moment, quel que soit l'état */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <span className="text-xs text-ink/40">Forcer un statut :</span>
              <select
                className="border rounded-md px-2 py-1 text-xs"
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
        )}
      </div>
    );
  }

  return (
    <div>
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Qualité</h1>
        <p className="text-ink/50 mb-1">
          Vue complète du pipeline : dossiers pas encore soumis, en vérification, et déjà audités.
        </p>
        <p className="text-xs text-isoGold mb-6">
          🎯 Objectif : vérification sous {seuilHeures}h après soumission par l'ingénieur.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {FILTRES_STATUT.map((f) => {
            const n = dossiers.filter((d) => !f.etats || f.etats.includes(d.etat)).length;
            return (
              <button
                key={f.key}
                onClick={() => setFiltreStatut(f.key)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 ${
                  filtreStatut === f.key ? "bg-isoGreen text-white" : "bg-white border"
                }`}
              >
                {f.label}
                <span
                  className={`text-xs rounded-full px-1.5 ${
                    filtreStatut === f.key ? "bg-white/20" : "bg-black/5 text-ink/50"
                  }`}
                >
                  {n}
                </span>
              </button>
            );
          })}
          <input
            className="border rounded-md px-3 py-1.5 text-sm ml-auto"
            placeholder="Rechercher un dossier…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <h2 className="font-display text-lg font-semibold mb-3">Aujourd'hui</h2>
        <div className="card divide-y mb-8">
          {aujourdHui.map((d) => <LigneDossier key={d.id} d={d} />)}
          {aujourdHui.length === 0 && (
            <p className="p-8 text-center text-ink/40">Rien pour aujourd'hui sur ce filtre.</p>
          )}
        </div>

        <h2 className="font-display text-lg font-semibold mb-3">Dossiers plus anciens</h2>
        <div className="card divide-y">
          {anciens.map((d) => <LigneDossier key={d.id} d={d} />)}
          {anciens.length === 0 && (
            <p className="p-8 text-center text-ink/40">Rien d'ancien sur ce filtre. 🎉</p>
          )}
        </div>
      </main>

      {dossierHistorique && (
        <HistoriqueComplet
          supabase={supabase}
          dossier={dossierHistorique}
          onFermer={() => setDossierHistorique(null)}
        />
      )}

      {derniereAction && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white rounded-full px-5 py-3 shadow-lg flex items-center gap-4 z-50">
          <span className="text-sm">Action effectuée sur « {derniereAction.nomDossier} »</span>
          <button onClick={annulerDerniereAction} className="text-isoGold text-sm font-semibold hover:underline">
            Annuler
          </button>
        </div>
      )}
    </div>
  );
}

function StatutBadge({ etat }) {
  const map = {
    "En attente de traitement": { texte: "Pas encore accepté", classe: "bg-black/10 text-ink/50" },
    "Encours": { texte: "Ingénieur en cours", classe: "bg-isoNavy/10 text-isoNavy" },
    "En attente de vérification": { texte: "À vérifier", classe: "bg-isoGold/10 text-isoGold" },
    "En cours de vérification": { texte: "En cours de vérif.", classe: "bg-isoNavy/10 text-isoNavy" },
    "Audité": { texte: "Audité · Envoyé au client", classe: "bg-isoGreen/10 text-isoGreen" },
    "Suspendue": { texte: "Suspendue", classe: "bg-isoRed/10 text-isoRed" },
    "en pause": { texte: "En pause", classe: "bg-isoGold/10 text-isoGold" },
    "Annulé": { texte: "Annulé", classe: "bg-black/10 text-ink/50" },
  };
  const s = map[etat] || { texte: etat, classe: "bg-black/5 text-ink/50" };
  return <span className={`badge ${s.classe}`}>{s.texte}</span>;
}
