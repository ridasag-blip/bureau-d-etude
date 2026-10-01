"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import { useAppData } from "@/lib/useAppData";
import GestionComptes from "@/components/GestionComptes";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import EmptyState from "@/components/ui/EmptyState";
import { ETATS } from "@/lib/constants";
import { COULEURS_DEFAUT, definirCouleurs, assombrir } from "@/lib/couleurs";
import { EcranChargement, EcranErreurProfil } from "@/components/ui/Screens";

const VUES = [
  ["comptes", "Comptes", "lock"],
  ["listes", "Listes déroulantes", "list"],
  ["habilitations", "Habilitations", "shield"],
  ["statuts", "Statuts", "layers"],
  ["objectifs", "Objectifs", "target"],
  ["config", "Config SLA", "sliders"],
  ["audit", "Journal d'audit", "history"],
  ["backups", "Sauvegardes", "database"],
];

const TABLES = [
  { key: "parametres_ingenieurs", label: "Ingénieurs", champ: "nom" },
  { key: "parametres_operations", label: "Opérations", champ: "libelle" },
  { key: "parametres_clients", label: "Clients", champ: "nom" },
  { key: "parametres_etats", label: "États", champ: "libelle" },
  { key: "parametres_validateurs", label: "Validateurs", champ: "nom" },
  { key: "parametres_causes_retour", label: "Causes de retour", champ: "libelle" },
];

export default function ParametresPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [habs, setHabs] = useState(null); // Set "ingenieur|operation"
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
  const [conservation, setConservation] = useState(90);
  const [purge, setPurge] = useState(null);
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
        setConservation(config.conservation_fichiers_jours || 90);
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

  async function majConservation(valeur) {
    const n = Math.max(1, Math.round(Number(valeur) || 90));
    setConservation(n);
    if (configId) {
      await supabase.from("parametres_config").update({ conservation_fichiers_jours: n }).eq("id", configId);
    }
  }

  async function purgerMaintenant() {
    if (!confirm(`Supprimer définitivement les pièces jointes des dossiers audités ou annulés depuis plus de ${conservation} jours ?`)) return;
    setPurge("…");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    try {
      const res = await fetch("/api/purge-fichiers", { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` } });
      const j = await res.json();
      setPurge(res.ok ? `${j.supprimes} fichier(s) supprimé(s).` : `Erreur : ${j.error}`);
    } catch (e) {
      setPurge("Erreur : " + e.message);
    }
  }

  const [statuts, setStatuts] = useState(null);

  async function chargerStatuts() {
    const { data } = await supabase.from("parametres_etats").select("id, libelle, couleur, ordre, actif").order("ordre");
    setStatuts((data || []).filter((e) => ETATS[e.libelle]));
  }

  async function majCouleur(etat, couleur) {
    setStatuts((l) => l.map((e) => (e.id === etat.id ? { ...e, couleur } : e)));
    const { error } = await supabase.from("parametres_etats").update({ couleur }).eq("id", etat.id);
    if (error) alert("Modification impossible : " + error.message);
    else definirCouleurs(Object.fromEntries((statuts || []).map((e) => [e.libelle, e.id === etat.id ? couleur : e.couleur])));
  }

  async function chargerHabilitations() {
    const { data, error } = await supabase.from("ingenieur_habilitations").select("ingenieur, operation");
    if (error) {
      setHabs(new Set());
      alert("Table des habilitations introuvable : exécute supabase/migration_workflow_v9.sql. (" + error.message + ")");
      return;
    }
    setHabs(new Set((data || []).map((h) => `${h.ingenieur}|${h.operation}`)));
  }

  async function basculerHabilitation(ingenieur, operation) {
    const cle = `${ingenieur}|${operation}`;
    const actif = habs.has(cle);
    const suivant = new Set(habs);
    actif ? suivant.delete(cle) : suivant.add(cle);
    setHabs(suivant);
    const { error } = actif
      ? await supabase.from("ingenieur_habilitations").delete().eq("ingenieur", ingenieur).eq("operation", operation)
      : await supabase.from("ingenieur_habilitations").insert({ ingenieur, operation });
    if (error) {
      alert("Modification impossible : " + error.message);
      chargerHabilitations();
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

  if (erreurProfil) return <EcranErreurProfil message={erreurProfil} />;
  if (loading || !profile) return <EcranChargement />;

  function carteSeuil({ titre, description, valeur, onChange, step, min, icone, ton = "brand", unite = "heures", pied = null }) {
    const tons = {
      brand: "bg-brand-50 text-brand-600",
      red: "bg-isoRed-light text-isoRed",
      gold: "bg-isoGold-light text-isoGold-dark",
    };
    return (
      <div className="card p-5 flex flex-col gap-4">
        <div className="flex gap-3">
          <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${tons[ton]}`}>
            <Icon name={icone} size={17} />
          </span>
          <div>
            <p className="font-semibold text-sm">{titre}</p>
            <p className="text-xs text-ink/55 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-auto">
          <input
            type="number"
            step={step}
            min={min}
            className="input w-28 tabular font-semibold"
            value={valeur}
            onChange={(e) => onChange(e.target.value)}
          />
          <span className="text-sm text-ink/50">{unite}</span>
        </div>
        {pied}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-[1800px] mx-auto px-3 sm:px-4 lg:px-5 py-6">
        <PageHeader icone="settings" titre="Paramètres" sousTitre="Configuration de l'application — réservé aux administrateurs." />

        <div className="flex gap-1 mb-6 overflow-x-auto scrollbar-none border-b border-line">
          {VUES.map(([v, label, icone]) => (
            <button
              key={v}
              onClick={() => {
                setVue(v);
                if (v === "audit") chargerAudit();
                if (v === "habilitations") chargerHabilitations();
                if (v === "statuts") chargerStatuts();
                if (v === "backups") chargerBackups();
              }}
              className={`flex items-center gap-2 px-3.5 h-10 -mb-px border-b-2 text-sm font-medium whitespace-nowrap transition-colors ${
                vue === v ? "border-brand-500 text-brand-600" : "border-transparent text-ink/55 hover:text-ink"
              }`}
            >
              <Icon name={icone} size={15} />
              {label}
            </button>
          ))}
        </div>

        {vue === "comptes" && <GestionComptes supabase={supabase} />}

        {vue === "listes" && (
          <div className="grid md:grid-cols-[220px_1fr] gap-6">
            <div className="flex md:flex-col gap-1 overflow-x-auto">
              {TABLES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setOngletActif(t.key)}
                  className={`text-left px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${
                    ongletActif === t.key ? "bg-brand-50 text-brand-700 font-semibold" : "text-ink/65 hover:bg-ink/5"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="card">
              <div className="flex gap-2 p-4 border-b border-line">
                <input
                  className="input flex-1"
                  placeholder={`Ajouter — ${table.label.toLowerCase()}`}
                  value={nouveau}
                  onChange={(e) => setNouveau(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && ajouterLigne()}
                />
                <button onClick={ajouterLigne} className="btn-primary" disabled={!nouveau.trim()}>
                  <Icon name="plus" size={15} />
                  Ajouter
                </button>
              </div>
              <ul className="divide-y divide-line">
                {lignes.map((l) => (
                  <li
                    key={l.id}
                    className={`px-4 py-2.5 flex justify-between items-center text-sm gap-3 ${l.actif === false ? "opacity-45" : ""}`}
                  >
                    <span className="font-medium">
                      {l[table.champ]}
                      {l.actif === false && <span className="badge badge-neutral ml-2">Désactivé</span>}
                    </span>
                    <div className="flex items-center gap-2">
                      {["parametres_ingenieurs", "parametres_validateurs"].includes(ongletActif) && (
                        <div className="relative">
                          <Icon name="lock" size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink/35" />
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="Code PIN"
                            defaultValue={l.pin || ""}
                            onBlur={(e) => majPin(ongletActif, l.id, e.target.value)}
                            className="input input-sm w-32 pl-7 tabular tracking-widest"
                          />
                        </div>
                      )}
                      {l.actif !== false && (
                        <button onClick={() => desactiverLigne(l.id)} className="btn-ghost btn-xs text-isoRed hover:bg-isoRed-light">
                          Désactiver
                        </button>
                      )}
                    </div>
                  </li>
                ))}
                {lignes.length === 0 && <EmptyState texte="Liste vide." compact />}
              </ul>
            </div>
          </div>
        )}

        {vue === "habilitations" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-ink/60">
              Coche les fiches CEE que chaque ingénieur peut prendre dans la file. La Qualité peut toujours assigner un dossier à la
              main hors habilitation.
            </p>
            <div className="card overflow-x-auto">
              {habs === null ? (
                <EmptyState icone="shield" texte="Chargement…" compact />
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ingénieur</th>
                      {options.operations.map((op) => (
                        <th key={op} className="!text-center">{op}</th>
                      ))}
                      <th className="!text-right">Fiches</th>
                    </tr>
                  </thead>
                  <tbody>
                    {options.ingenieurs.map((ing) => {
                      const n = options.operations.filter((op) => habs.has(`${ing}|${op}`)).length;
                      return (
                        <tr key={ing}>
                          <td className="font-semibold capitalize">{ing}</td>
                          {options.operations.map((op) => {
                            const actif = habs.has(`${ing}|${op}`);
                            return (
                              <td key={op} className="text-center">
                                <button
                                  onClick={() => basculerHabilitation(ing, op)}
                                  aria-pressed={actif}
                                  aria-label={`${ing} — ${op}`}
                                  className={`w-7 h-7 rounded-md inline-flex items-center justify-center border transition-colors ${
                                    actif ? "bg-brand-500 border-brand-500 text-white" : "bg-white border-line text-transparent hover:border-ink/30"
                                  }`}
                                >
                                  <Icon name="check" size={15} />
                                </button>
                              </td>
                            );
                          })}
                          <td className="text-right tabular text-ink/60">{n}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="text-xs text-ink/50">Ingénieurs habilités</td>
                      {options.operations.map((op) => {
                        const n = options.ingenieurs.filter((ing) => habs.has(`${ing}|${op}`)).length;
                        return (
                          <td key={op} className={`text-center text-xs font-semibold tabular ${n <= 1 ? "text-isoRed" : "text-ink/60"}`}>
                            {n}
                            {n <= 1 && <span className="block font-normal">à risque</span>}
                          </td>
                        );
                      })}
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {vue === "statuts" && (
          <div className="flex flex-col gap-4 max-w-3xl">
            <p className="text-sm text-ink/60">
              Couleur de chaque statut, appliquée partout dans l'app (Saisie, Qualité, Dashboard, écran ingénieur).
            </p>
            <div className="card divide-y divide-line">
              {statuts === null && <EmptyState texte="Chargement…" compact />}
              {(statuts || []).map((e) => {
                const hex = /^#[0-9a-f]{6}$/i.test(e.couleur || "") ? e.couleur : COULEURS_DEFAUT[e.libelle] || "#8A96A3";
                return (
                <div key={e.id} className="flex items-center gap-4 px-5 py-3">
                  <input
                    type="color"
                    value={hex}
                    onChange={(ev) => setStatuts((l) => l.map((x) => (x.id === e.id ? { ...x, couleur: ev.target.value } : x)))}
                    onBlur={(ev) => majCouleur(e, ev.target.value)}
                    className="w-10 h-10 rounded-lg border border-line cursor-pointer p-0.5 bg-white"
                    aria-label={`Couleur du statut ${ETATS[e.libelle]?.court}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{ETATS[e.libelle]?.court}</p>
                    <p className="text-xs text-ink/45">Valeur en base : {e.libelle}</p>
                  </div>
                  <span
                    className="badge badge-dot"
                    style={{
                      background: `${hex}22`,
                      color: assombrir(hex, 0.7),
                    }}
                  >
                    {ETATS[e.libelle]?.court}
                  </span>
                  {COULEURS_DEFAUT[e.libelle] && hex.toLowerCase() !== COULEURS_DEFAUT[e.libelle].toLowerCase() && (
                    <button className="btn-ghost btn-xs" onClick={() => majCouleur(e, COULEURS_DEFAUT[e.libelle])}>
                      Par défaut
                    </button>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        )}

        {vue === "objectifs" && (
          <div className="card overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Ingénieur</th>
                  <th>Objectif nouveaux dossiers</th>
                  <th>Objectif modifications</th>
                </tr>
              </thead>
              <tbody>
                {ingenieurs.map((ing) => {
                  const obj = objectifs.find((o) => o.ingenieur === ing) || {};
                  return (
                    <tr key={ing}>
                      <td className="font-semibold capitalize">{ing}</td>
                      <td>
                        <input
                          type="number"
                          className="input input-sm w-24 tabular"
                          defaultValue={obj.objectif_nv_dossier || 0}
                          onBlur={(e) => majObjectif(ing, "objectif_nv_dossier", e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className="input input-sm w-24 tabular"
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
          <div className="grid md:grid-cols-3 gap-4">
            {carteSeuil({
              titre: "Seuil d'alerte — 1ʳᵉ vérification",
              description:
                "Un dossier soumis mais pas encore vérifié au-delà de ce délai passe en alerte (badge de temps rouge sur la page Qualité).",
              valeur: seuilVerification,
              onChange: majSeuilVerification,
              step: "0.5",
              min: "0.5",
              icone: "clock",
              ton: "gold",
            })}
            {carteSeuil({
              titre: "Seuil d'urgence",
              description: "Au-delà de ce délai sans vérification, le dossier est signalé en urgence (icône flamme) sur la page Qualité.",
              valeur: seuilUrgence,
              onChange: majSeuilUrgence,
              step: "1",
              min: "1",
              icone: "flame",
              ton: "red",
            })}
            {carteSeuil({
              titre: "Délai max. de traitement (ingénieur)",
              description: "Depuis l'acceptation d'un dossier, affiche un compte à rebours « Il te reste X h » dans Mes dossiers.",
              valeur: delaiMaxTraitement,
              onChange: majDelaiMaxTraitement,
              step: "1",
              min: "1",
              icone: "target",
              ton: "brand",
            })}
            {carteSeuil({
              titre: "Conservation des pièces jointes",
              description:
                "Les fichiers d'un dossier audité ou annulé sont supprimés automatiquement (chaque nuit) après ce délai, pour libérer l'espace de stockage.",
              valeur: conservation,
              onChange: majConservation,
              step: "1",
              min: "1",
              icone: "database",
              ton: "gold",
              unite: "jours",
              pied: (
                <div className="flex items-center gap-2 flex-wrap">
                  <button className="btn-secondary btn-sm" onClick={purgerMaintenant} disabled={purge === "…"}>
                    <Icon name="reset" size={13} />
                    Purger maintenant
                  </button>
                  {purge && <span className="text-xs text-ink/60">{purge === "…" ? "Purge en cours…" : purge}</span>}
                </div>
              ),
            })}
          </div>
        )}

        {vue === "audit" && (
          <div className="card overflow-x-auto">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Action</th>
                  <th>Table</th>
                  <th>Par</th>
                </tr>
              </thead>
              <tbody>
                {auditLog.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap text-ink/60 tabular">{new Date(a.created_at).toLocaleString("fr-FR")}</td>
                    <td>
                      <span
                        className={`badge ${
                          a.action === "DELETE" ? "badge-red" : a.action === "INSERT" ? "badge-green" : "badge-brand"
                        }`}
                      >
                        {a.action}
                      </span>
                    </td>
                    <td className="font-mono text-xs text-ink/65">{a.table_name}</td>
                    <td className="capitalize">{a.effectue_par_nom || "—"}</td>
                  </tr>
                ))}
                {auditLog.length === 0 && (
                  <tr>
                    <td colSpan={4} className="table-empty">Aucune entrée.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {vue === "backups" && (
          <div className="flex flex-col gap-4">
            <div className="card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-sm">Sauvegarde manuelle</p>
                <p className="text-xs text-ink/55 mt-1">
                  Une sauvegarde automatique hebdomadaire est aussi planifiée côté Supabase (fonction{" "}
                  <code className="font-mono bg-paper px-1 rounded">fn_backup_hebdomadaire</code>).
                </p>
              </div>
              <button onClick={lancerSauvegardeManuelle} className="btn-primary">
                <Icon name="database" size={15} />
                Sauvegarder maintenant
              </button>
            </div>
            <div className="card divide-y divide-line">
              {backups.map((b) => (
                <div key={b.id} className="px-5 py-3 flex justify-between items-center text-sm gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-8 h-8 rounded-lg bg-paper text-ink/50 flex items-center justify-center">
                      <Icon name="database" size={15} />
                    </span>
                    <div>
                      <p className="font-semibold">{new Date(b.created_at).toLocaleString("fr-FR")}</p>
                      <p className="text-ink/45 text-xs">
                        {b.nb_dossiers} dossiers · {b.declenche_par}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => telechargerBackup(b)} className="btn-secondary btn-xs">
                    <Icon name="download" size={13} />
                    Télécharger
                  </button>
                </div>
              ))}
              {backups.length === 0 && <EmptyState icone="database" texte="Aucune sauvegarde encore." />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
