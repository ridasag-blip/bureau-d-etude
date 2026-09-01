"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAppData } from "@/lib/useAppData";
import GestionComptes from "@/components/GestionComptes";

const TABLES = [
  { key: "parametres_ingenieurs", label: "Ingénieurs", champ: "nom" },
  { key: "parametres_operations", label: "Opérations", champ: "libelle" },
  { key: "parametres_clients", label: "Clients", champ: "nom" },
  { key: "parametres_etats", label: "États", champ: "libelle" },
  { key: "parametres_validateurs", label: "Validateurs", champ: "nom" },
  { key: "parametres_causes_retour", label: "Causes de retour", champ: "libelle" },
];

export default function ParametresPage() {
  const { profile, erreurProfil, loading, supabase } = useAppData();
  const [ongletActif, setOngletActif] = useState(TABLES[0].key);
  const [lignes, setLignes] = useState([]);
  const [nouveau, setNouveau] = useState("");
  const [objectifs, setObjectifs] = useState([]);
  const [ingenieurs, setIngenieurs] = useState([]);
  const [auditLog, setAuditLog] = useState([]);
  const [backups, setBackups] = useState([]);
  const [vue, setVue] = useState("listes"); // listes | objectifs | config | audit | backups
  const [seuilVerification, setSeuilVerification] = useState(1);
  const [seuilUrgence, setSeuilUrgence] = useState(24);
  const [delaiMaxTraitement, setDelaiMaxTraitement] = useState(24);
  const [configId, setConfigId] = useState(null);

  const table = TABLES.find((t) => t.key === ongletActif);

  async function chargerListe() {
    const { data } = await supabase.from(ongletActif).select("*").order(table.champ);
    setLignes(data || []);
  }

  useEffect(() => {
    if (profile) chargerListe();
  }, [ongletActif, profile]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: objs }, { data: ings }] = await Promise.all([
        supabase.from("objectifs").select("*"),
        supabase.from("parametres_ingenieurs").select("nom").eq("actif", true),
      ]);
      setObjectifs(objs || []);
      setIngenieurs((ings || []).map((r) => r.nom));

      const { data: config } = await supabase.from("parametres_config").select("*").limit(1).maybeSingle();
      if (config) {
        setSeuilVerification(config.seuil_verification_heures);
        setSeuilUrgence(config.seuil_urgence_heures || 24);
        setDelaiMaxTraitement(config.delai_max_traitement_heures || 24);
        setConfigId(config.id);
      }
    })();
  }, [profile]);

  async function majSeuilVerification(valeur) {
    const n = Number(valeur) || 1;
    setSeuilVerification(n);
    if (configId) {
      await supabase.from("parametres_config").update({ seuil_verification_heures: n }).eq("id", configId);
    }
  }

  async function majSeuilUrgence(valeur) {
    const n = Number(valeur) || 24;
    setSeuilUrgence(n);
    if (configId) {
      await supabase.from("parametres_config").update({ seuil_urgence_heures: n }).eq("id", configId);
    }
  }

  async function majDelaiMaxTraitement(valeur) {
    const n = Number(valeur) || 24;
    setDelaiMaxTraitement(n);
    if (configId) {
      await supabase.from("parametres_config").update({ delai_max_traitement_heures: n }).eq("id", configId);
    }
  }

  async function chargerAudit() {
    const { data } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setAuditLog(data || []);
  }

  async function chargerBackups() {
    const { data } = await supabase
      .from("backups")
      .select("id, nb_dossiers, declenche_par, created_at")
      .order("created_at", { ascending: false })
      .limit(20);
    setBackups(data || []);
  }

  async function ajouterLigne() {
    if (!nouveau.trim()) return;
    const payload = { [table.champ]: nouveau.trim() };
    if (ongletActif === "parametres_causes_retour") payload.type = "generique";
    await supabase.from(ongletActif).insert(payload);
    setNouveau("");
    chargerListe();
  }

  async function desactiverLigne(id) {
    await supabase.from(ongletActif).update({ actif: false }).eq("id", id);
    chargerListe();
  }

  async function majPin(table, id, pin) {
    await supabase.from(table).update({ pin }).eq("id", id);
    chargerListe();
  }

  async function majObjectif(ingenieur, champ, valeur) {
    await supabase.from("objectifs").upsert(
      { ingenieur, [champ]: Number(valeur) || 0 },
      { onConflict: "ingenieur" }
    );
    const { data } = await supabase.from("objectifs").select("*");
    setObjectifs(data || []);
  }

  async function lancerSauvegardeManuelle() {
    const { data: doss } = await supabase.from("dossiers").select("*");
    await supabase.from("backups").insert({
      contenu: doss,
      nb_dossiers: doss?.length || 0,
      declenche_par: profile.nom_complet,
    });
    chargerBackups();
    alert("Sauvegarde effectuée.");
  }

  function telechargerBackup(backup) {
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `hillsolution_backup_${backup.created_at?.slice(0, 10)}.json`;
    a.click();
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
      <main className="max-w-6xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Paramètres</h1>
        <p className="text-ink/50 mb-6">Réservé aux administrateurs.</p>

        <div className="flex gap-2 mb-6">
          {[
            ["comptes", "Comptes (login/mot de passe)"],
            ["listes", "Listes déroulantes"],
            ["objectifs", "Objectifs"],
            ["config", "Config SLA"],
            ["audit", "Journal d'audit"],
            ["backups", "Sauvegardes"],
          ].map(([v, label]) => (
            <button
              key={v}
              onClick={() => {
                setVue(v);
                if (v === "audit") chargerAudit();
                if (v === "backups") chargerBackups();
              }}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                vue === v ? "bg-isoGreen text-white" : "bg-white border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {vue === "comptes" && <GestionComptes supabase={supabase} />}

        {vue === "listes" && (
          <div className="grid md:grid-cols-[200px_1fr] gap-6">
            <div className="flex flex-col gap-1">
              {TABLES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setOngletActif(t.key)}
                  className={`text-left px-3 py-2 rounded-md text-sm ${
                    ongletActif === t.key ? "bg-isoGreen-light text-isoGreen-dark font-medium" : "hover:bg-black/5"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="card p-4">
              <div className="flex gap-2 mb-4">
                <input
                  className="border rounded-md px-2 py-1.5 text-sm flex-1"
                  placeholder={`Ajouter — ${table.label.toLowerCase()}`}
                  value={nouveau}
                  onChange={(e) => setNouveau(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ajouterLigne()}
                />
                <button onClick={ajouterLigne} className="btn-primary !py-1.5">Ajouter</button>
              </div>
              <ul className="divide-y">
                {lignes.map((l) => (
                  <li key={l.id} className="py-2 flex justify-between items-center text-sm gap-3">
                    <span>{l[table.champ]}</span>
                    <div className="flex items-center gap-2">
                      {["parametres_ingenieurs", "parametres_validateurs"].includes(ongletActif) && (
                        <input
                          type="text"
                          maxLength={6}
                          placeholder="Code (6 chiffres)"
                          defaultValue={l.pin || ""}
                          onBlur={(e) => majPin(ongletActif, l.id, e.target.value)}
                          className="border rounded-md px-2 py-1 text-xs w-28"
                        />
                      )}
                      <button onClick={() => desactiverLigne(l.id)} className="text-isoRed text-xs hover:underline">
                        Désactiver
                      </button>
                    </div>
                  </li>
                ))}
                {lignes.length === 0 && <li className="py-4 text-center text-ink/40 text-sm">Vide.</li>}
              </ul>
            </div>
          </div>
        )}

        {vue === "objectifs" && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/50 uppercase border-b">
                  <th className="px-3 py-2">Ingénieur</th>
                  <th className="px-3 py-2">Objectif nv. dossier</th>
                  <th className="px-3 py-2">Objectif modif.</th>
                </tr>
              </thead>
              <tbody>
                {ingenieurs.map((ing) => {
                  const obj = objectifs.find((o) => o.ingenieur === ing) || {};
                  return (
                    <tr key={ing} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">{ing}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="border rounded-md px-2 py-1 w-24 text-sm"
                          defaultValue={obj.objectif_nv_dossier || 0}
                          onBlur={(e) => majObjectif(ing, "objectif_nv_dossier", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          className="border rounded-md px-2 py-1 w-24 text-sm"
                          defaultValue={obj.objectif_modif || 0}
                          onBlur={(e) => majObjectif(ing, "objectif_modif", e.target.value)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {vue === "config" && (
          <div className="flex flex-col gap-4 max-w-sm">
            <div className="card p-4">
              <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
                Seuil d'alerte — 1ère vérification qualité
              </p>
              <p className="text-sm text-ink/60 mb-3">
                Un dossier assigné mais pas encore vérifié au-delà de ce délai déclenche une alerte
                (badge rouge sur « Qualité » et sur le Dashboard).
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  className="border rounded-md px-2 py-1.5 text-sm w-24"
                  value={seuilVerification}
                  onChange={(e) => majSeuilVerification(e.target.value)}
                />
                <span className="text-sm text-ink/50">heures</span>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-xs font-semibold text-isoRed uppercase tracking-wide mb-3">
                🔥 Seuil d'urgence
              </p>
              <p className="text-sm text-ink/60 mb-3">
                Au-delà de ce délai sans vérification, le dossier s'affiche avec une alerte urgence
                sur la page Qualité.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="border rounded-md px-2 py-1.5 text-sm w-24"
                  value={seuilUrgence}
                  onChange={(e) => majSeuilUrgence(e.target.value)}
                />
                <span className="text-sm text-ink/50">heures</span>
              </div>
            </div>

            <div className="card p-4">
              <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
                Délai max. de traitement (côté ingénieur)
              </p>
              <p className="text-sm text-ink/60 mb-3">
                Depuis l'acceptation d'un dossier, affiche un compte à rebours « Il te reste X temps »
                dans Mes dossiers.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="border rounded-md px-2 py-1.5 text-sm w-24"
                  value={delaiMaxTraitement}
                  onChange={(e) => majDelaiMaxTraitement(e.target.value)}
                />
                <span className="text-sm text-ink/50">heures</span>
              </div>
            </div>
          </div>
        )}

        {vue === "audit" && (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink/50 uppercase border-b">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Action</th>
                  <th className="px-3 py-2">Table</th>
                  <th className="px-3 py-2">Par</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString("fr-FR")}
                    </td>
                    <td className="px-3 py-2">
                      <span className="badge bg-black/5">{a.action}</span>
                    </td>
                    <td className="px-3 py-2">{a.table_name}</td>
                    <td className="px-3 py-2">{a.effectue_par_nom || "—"}</td>
                  </tr>
                ))}
                {auditLog.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-8 text-center text-ink/40">Aucune entrée.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {vue === "backups" && (
          <div className="flex flex-col gap-4">
            <button onClick={lancerSauvegardeManuelle} className="btn-primary self-start">
              Lancer une sauvegarde maintenant
            </button>
            <p className="text-xs text-ink/40">
              Une sauvegarde automatique hebdomadaire est planifiée côté Supabase (voir schema.sql,
              fonction <code>fn_backup_hebdomadaire</code>).
            </p>
            <div className="card divide-y">
              {backups.map((b) => (
                <div key={b.id} className="px-4 py-3 flex justify-between items-center text-sm">
                  <div>
                    <p className="font-medium">{new Date(b.created_at).toLocaleString("fr-FR")}</p>
                    <p className="text-ink/40 text-xs">{b.nb_dossiers} dossiers · {b.declenche_par}</p>
                  </div>
                  <button onClick={() => telechargerBackup(b)} className="btn-secondary !py-1 !px-3 text-xs">
                    Télécharger
                  </button>
                </div>
              ))}
              {backups.length === 0 && (
                <p className="px-4 py-8 text-center text-ink/40 text-sm">Aucune sauvegarde encore.</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
