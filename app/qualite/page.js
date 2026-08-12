"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import SelectionPersonne from "@/components/SelectionPersonne";
import HorlogeDigitale from "@/components/HorlogeDigitale";
import { useAppData } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";

const FILTRES_STATUT = [
  { key: "a_verifier", label: "À vérifier", etats: ["En attente de vérification"] },
  { key: "en_cours_verif", label: "En cours de vérif.", etats: ["En cours de vérification"] },
  { key: "audite", label: "Audité — Envoyé", etats: ["Audité"] },
  { key: "tous", label: "Tous", etats: null },
];

const AIDE_PAR_ETAT = {
  "En attente de vérification":
    "Ce dossier attend d'être pris en charge par la Qualité, avant sa 1ère vérification.",
  "En cours de vérification":
    "Ce dossier n'est pas encore envoyé au client. Valide-le pour l'auditer, ou renvoie-le en interne si besoin de correction.",
  "Audité":
    "Dossier envoyé au client. S'il revient (faute interne découverte ou modification demandée), utilise les boutons ci-dessous.",
};

export default function QualitePage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomActif, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const [dossiers, setDossiers] = useState([]);
  const [filtreStatut, setFiltreStatut] = useState("a_verifier");
  const [recherche, setRecherche] = useState("");
  const [seuilHeures, setSeuilHeures] = useState(1);
  const [dossierActif, setDossierActif] = useState(null);
  const [typeAction, setTypeAction] = useState(null);
  const [form, setForm] = useState({ cause: "", ingenieur_modif: "" });

  async function chargerDossiers() {
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .in("etat", ["En attente de vérification", "En cours de vérification", "Audité"])
      .order("date_soumission", { ascending: true, nullsFirst: false });
    setDossiers(data || []);
  }

  useEffect(() => {
    if (!profile) return;
    chargerDossiers();
    (async () => {
      const { data } = await supabase.from("parametres_config").select("*").limit(1).maybeSingle();
      if (data) setSeuilHeures(data.seuil_verification_heures);
    })();
  }, [profile]);

  async function enregistrerEvenement(dossierId, type, cause) {
    await supabase.from("dossier_evenements").insert({
      dossier_id: dossierId,
      type,
      cause: cause || null,
      effectue_par_nom: nomActif,
    });
  }

  async function prendreEnCharge(d) {
    await supabase
      .from("dossiers")
      .update({
        etat: "En cours de vérification",
        pris_en_charge_par: nomActif,
        date_prise_en_charge: new Date().toISOString(),
      })
      .eq("id", d.id);
    await enregistrerEvenement(d.id, "prise_en_charge");
    chargerDossiers();
  }

  async function valider(d) {
    await supabase
      .from("dossiers")
      .update({
        etat: "Audité",
        date_verification: new Date().toISOString(),
        valide_par: nomActif,
      })
      .eq("id", d.id);
    await enregistrerEvenement(d.id, "verification_ok");
    setDossierActif(null);
    chargerDossiers();
    alert("Audit réalisé avec succès.");
  }

  async function enregistrerRetour(d) {
    if (!form.cause) return alert("Précise la cause.");

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

  if (erreurProfil) {
    return (
      <div className="p-10 max-w-lg mx-auto text-center">
        <p className="text-isoRed font-medium mb-2">Profil introuvable</p>
        <p className="text-sm text-ink/60">{erreurProfil}</p>
      </div>
    );
  }
  if (loading || !profile || !pretPersonne) return <div className="p-10 text-center text-ink/40">Chargement…</div>;

  if (!nomActif) {
    return <SelectionPersonne personnes={validateurs} onSelection={selectionner} />;
  }

  function heuresEnAttente(d) {
    if (!d.date_soumission) return null;
    return (Date.now() - new Date(d.date_soumission).getTime()) / 3600000;
  }

  const filtreActuel = FILTRES_STATUT.find((f) => f.key === filtreStatut);
  const liste = dossiers
    .filter((d) => !filtreActuel.etats || filtreActuel.etats.includes(d.etat))
    .filter((d) => d.nom_dossier?.toLowerCase().includes(recherche.toLowerCase()));

  return (
    <div>
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={changerDePersonne} />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex justify-between items-baseline mb-1">
          <h1 className="font-display text-2xl font-bold">Qualité</h1>
          <HorlogeDigitale />
        </div>
        <p className="text-ink/50 mb-6">
          Vérification des dossiers et traitement des retours (interne ou client), en un seul endroit.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {FILTRES_STATUT.map((f) => (
            <button
              key={f.key}
              onClick={() => setFiltreStatut(f.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                filtreStatut === f.key ? "bg-isoGreen text-white" : "bg-white border"
              }`}
            >
              {f.label}
            </button>
          ))}
          <input
            className="border rounded-md px-3 py-1.5 text-sm ml-auto"
            placeholder="Rechercher un dossier…"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
          />
        </div>

        <div className="card divide-y">
          {liste.map((d) => {
            const h = heuresEnAttente(d);
            const enRetard = h !== null && h > seuilHeures;
            return (
              <div key={d.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">
                      {d.nom_dossier}
                      {d.recurrent && <span className="badge bg-isoRed/10 text-isoRed ml-2">⚠ Récurrent</span>}
                    </p>
                    <p className="text-xs text-ink/40">
                      {d.ingenieur} · {d.nom_operation} · {d.client}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatutBadge etat={d.etat} />
                    {h !== null && (
                      <span className={`badge ${enRetard ? "bg-isoRed/10 text-isoRed" : "bg-black/5 text-ink/50"}`}>
                        {h.toFixed(1)}h
                      </span>
                    )}
                    {d.pris_en_charge_par && (
                      <span className="text-xs text-ink/40">par {d.pris_en_charge_par}</span>
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
                  </div>
                )}
              </div>
            );
          })}
          {liste.length === 0 && (
            <p className="p-8 text-center text-ink/40">Rien ici pour l'instant. 🎉</p>
          )}
        </div>
      </main>
    </div>
  );
}

function StatutBadge({ etat }) {
  const map = {
    "En attente de vérification": { texte: "À vérifier", classe: "bg-isoGold/10 text-isoGold" },
    "En cours de vérification": { texte: "En cours de vérif.", classe: "bg-isoNavy/10 text-isoNavy" },
    "Audité": { texte: "Audité · Envoyé au client", classe: "bg-isoGreen/10 text-isoGreen" },
  };
  const s = map[etat] || { texte: etat, classe: "bg-black/5 text-ink/50" };
  return <span className={`badge ${s.classe}`}>{s.texte}</span>;
}
