"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAppData } from "@/lib/useAppData";

export default function RetoursPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [audites, setAudites] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [dossierActif, setDossierActif] = useState(null);
  const [type, setType] = useState("interne"); // interne | client
  const [form, setForm] = useState({ cause: "", ingenieur_modif: "" });

  async function chargerAudites() {
    const { data } = await supabase
      .from("dossiers")
      .select("*")
      .eq("etat", "Audité")
      .order("date_verification", { ascending: false })
      .limit(300);
    setAudites(data || []);
  }

  useEffect(() => {
    if (profile) chargerAudites();
  }, [profile]);

  async function enregistrerEvenement(dossierId, evtType, cause) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    await supabase.from("dossier_evenements").insert({
      dossier_id: dossierId,
      type: evtType,
      cause: cause || null,
      effectue_par: user.id,
      effectue_par_nom: profile.nom_complet,
    });
  }

  async function enregistrerRetour(d) {
    if (!form.cause) return alert("Précise la cause du retour.");

    const payload =
      type === "interne"
        ? {
            retour_interne: true,
            cause_retour_interne: form.cause,
            ingenieur_modif: form.ingenieur_modif || null,
            etat: "Encours",
            date_verification: null,
            nb_retours: (d.nb_retours || 0) + 1,
          }
        : {
            retour_client: true,
            cause_retour_client: form.cause,
            date_retour_client: new Date().toISOString().slice(0, 10),
            ingenieur_modif: form.ingenieur_modif || null,
            etat: "Encours",
            date_verification: null,
            nb_retours: (d.nb_retours || 0) + 1,
          };

    const { error } = await supabase.from("dossiers").update(payload).eq("id", d.id);
    if (error) return alert("Erreur : " + error.message);

    await enregistrerEvenement(
      d.id,
      type === "interne" ? "retour_interne_apres_audit" : "retour_client",
      form.cause
    );

    setDossierActif(null);
    setForm({ cause: "", ingenieur_modif: "" });
    chargerAudites();
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

  const filtres = audites.filter((d) =>
    d.nom_dossier?.toLowerCase().includes(recherche.toLowerCase())
  );

  return (
    <div>
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Retours post-audit</h1>
        <p className="text-ink/50 mb-6">
          Un dossier déjà audité (envoyé au client) revient pour une faute interne découverte après
          coup, ou une modification demandée par le client.
        </p>

        <input
          className="border rounded-md px-3 py-2 text-sm mb-4 w-full max-w-sm"
          placeholder="Rechercher un dossier audité…"
          value={recherche}
          onChange={(e) => setRecherche(e.target.value)}
        />

        <div className="card divide-y">
          {filtres.map((d) => (
            <div key={d.id} className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">
                    {d.nom_dossier}
                    {d.recurrent && (
                      <span className="badge bg-isoRed/10 text-isoRed ml-2">⚠ Récurrent</span>
                    )}
                  </p>
                  <p className="text-xs text-ink/40">
                    {d.ingenieur} · {d.nom_operation} · audité le{" "}
                    {d.date_verification ? new Date(d.date_verification).toLocaleDateString("fr-FR") : "—"}
                  </p>
                </div>
                <button
                  className="btn-secondary !py-1 !px-3 text-xs"
                  onClick={() => setDossierActif(dossierActif === d.id ? null : d.id)}
                >
                  Signaler un retour
                </button>
              </div>

              {dossierActif === d.id && (
                <div className="mt-4 pt-4 border-t flex flex-col gap-3">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setType("interne")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                        type === "interne" ? "bg-isoGold text-white" : "bg-white border"
                      }`}
                    >
                      Faute interne
                    </button>
                    <button
                      onClick={() => setType("client")}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                        type === "client" ? "bg-isoRed text-white" : "bg-white border"
                      }`}
                    >
                      Modification client
                    </button>
                  </div>

                  <select
                    className="border rounded-md px-2 py-1.5 text-sm"
                    value={form.cause}
                    onChange={(e) => setForm((f) => ({ ...f, cause: e.target.value }))}
                  >
                    <option value="">Cause —</option>
                    {(type === "interne" ? options.causesInterne : options.causesClient)?.map((c) => (
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
          ))}
          {filtres.length === 0 && (
            <p className="p-8 text-center text-ink/40">Aucun dossier audité pour l'instant.</p>
          )}
        </div>
      </main>
    </div>
  );
}
