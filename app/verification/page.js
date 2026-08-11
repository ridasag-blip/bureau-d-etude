"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAppData } from "@/lib/useAppData";

export default function VerificationPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [file, setFile] = useState([]);
  const [seuilHeures, setSeuilHeures] = useState(1);
  const [dossierActif, setDossierActif] = useState(null);
  const [formRetour, setFormRetour] = useState({ cause: "", ingenieur_modif: "" });

  async function chargerFile() {
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .eq("etat", "Encours")
      .is("date_verification", null)
      .order("date_assignation", { ascending: true });
    setFile(data || []);
  }

  useEffect(() => {
    if (!profile) return;
    chargerFile();
    (async () => {
      const { data } = await supabase.from("parametres_config").select("*").limit(1).maybeSingle();
      if (data) setSeuilHeures(data.seuil_verification_heures);
    })();
  }, [profile]);

  function heuresEnAttente(d) {
    return (Date.now() - new Date(d.date_assignation).getTime()) / 3600000;
  }

  async function enregistrerEvenement(dossierId, type, cause) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("dossier_evenements").insert({
      dossier_id: dossierId,
      type,
      cause: cause || null,
      effectue_par: user.id,
      effectue_par_nom: profile.nom_complet,
    });
  }

  async function valider(d) {
    const { error } = await supabase
      .from("dossiers")
      .update({
        etat: "Audité",
        date_verification: new Date().toISOString(),
        valide_par: profile.nom_complet,
      })
      .eq("id", d.id);
    if (error) return alert("Erreur : " + error.message);
    await enregistrerEvenement(d.id, "verification_ok");
    setDossierActif(null);
    chargerFile();
  }

  async function retourInterne(d) {
    if (!formRetour.cause) return alert("Précise la cause du retour interne.");
    const { error } = await supabase
      .from("dossiers")
      .update({
        retour_interne: true,
        cause_retour_interne: formRetour.cause,
        ingenieur_modif: formRetour.ingenieur_modif || null,
        date_verification: new Date().toISOString(),
        nb_retours: (d.nb_retours || 0) + 1,
      })
      .eq("id", d.id);
    if (error) return alert("Erreur : " + error.message);
    await enregistrerEvenement(d.id, "retour_interne_avant_audit", formRetour.cause);
    setDossierActif(null);
    setFormRetour({ cause: "", ingenieur_modif: "" });
    chargerFile();
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

  return (
    <div>
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Vérification qualité</h1>
        <p className="text-ink/50 mb-6">
          File d'attente des dossiers en attente de 1ère vérification (objectif : {seuilHeures}h).
        </p>

        <div className="card divide-y">
          {file.map((d) => {
            const h = heuresEnAttente(d);
            const enRetard = h > seuilHeures;
            return (
              <div key={d.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{d.nom_dossier}</p>
                    <p className="text-xs text-ink/40">
                      {d.ingenieur} · {d.nom_operation} · {d.client}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`badge ${enRetard ? "bg-isoRed/10 text-isoRed" : "bg-black/5 text-ink/50"}`}>
                      {h.toFixed(1)}h en attente
                    </span>
                    <button
                      className="btn-secondary !py-1 !px-3 text-xs"
                      onClick={() => setDossierActif(dossierActif === d.id ? null : d.id)}
                    >
                      Traiter
                    </button>
                  </div>
                </div>

                {dossierActif === d.id && (
                  <div className="mt-4 pt-4 border-t flex flex-col gap-3">
                    <div className="flex gap-3">
                      <button onClick={() => valider(d)} className="btn-primary !py-1.5 text-sm">
                        ✓ Valider (Audité)
                      </button>
                    </div>
                    <div className="flex flex-col gap-2 bg-isoRed/5 border border-isoRed/20 rounded-md p-3">
                      <p className="text-xs font-semibold text-isoRed uppercase">Retour interne</p>
                      <select
                        className="border rounded-md px-2 py-1.5 text-sm"
                        value={formRetour.cause}
                        onChange={(e) => setFormRetour((f) => ({ ...f, cause: e.target.value }))}
                      >
                        <option value="">Cause du retour —</option>
                        {options.causesInterne?.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      <select
                        className="border rounded-md px-2 py-1.5 text-sm"
                        value={formRetour.ingenieur_modif}
                        onChange={(e) => setFormRetour((f) => ({ ...f, ingenieur_modif: e.target.value }))}
                      >
                        <option value="">Réassigner à (optionnel) —</option>
                        {options.ingenieurs?.map((i) => (
                          <option key={i} value={i}>{i}</option>
                        ))}
                      </select>
                      <button onClick={() => retourInterne(d)} className="btn-secondary !py-1.5 text-sm self-start border-isoRed text-isoRed">
                        Renvoyer à l'ingénieur
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {file.length === 0 && (
            <p className="p-8 text-center text-ink/40">File vide — tout est à jour. 🎉</p>
          )}
        </div>
      </main>
    </div>
  );
}
