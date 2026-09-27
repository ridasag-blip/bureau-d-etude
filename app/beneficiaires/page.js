"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import Navbar from "@/components/Navbar";
import HistoriqueComplet from "@/components/HistoriqueComplet";
import PageHeader from "@/components/ui/PageHeader";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";
import StatutBadge from "@/components/ui/StatutBadge";
import EmptyState from "@/components/ui/EmptyState";
import { EcranChargement, EcranErreurProfil } from "@/components/ui/Screens";
import { useAppData } from "@/lib/useAppData";
import { grouperBeneficiaires, doublonsSuggeres } from "@/lib/beneficiaires";
import { formatDate, formatTelephone, normaliserAdresse, normaliserTelephone, ETATS } from "@/lib/constants";

function nouvelId() {
  return typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `g${Date.now()}${Math.random()}`;
}

export default function BeneficiairesPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [dossiers, setDossiers] = useState([]);
  const [recherche, setRecherche] = useState("");
  const [fiche, setFiche] = useState("Toutes");
  const [statut, setStatut] = useState("Tous");
  const [du, setDu] = useState("");
  const [au, setAu] = useState("");
  const [ouvert, setOuvert] = useState(null); // clé du bénéficiaire ouvert
  const [historique, setHistorique] = useState(null);
  const [voirDoublons, setVoirDoublons] = useState(false);

  async function charger() {
    const { data } = await supabase
      .from("dossiers")
      .select(
        "id, date, nom_dossier, nom_operation, etat, ingenieur, nb_retours, beneficiaire_nom, beneficiaire_siret, beneficiaire_adresse, beneficiaire_email, beneficiaire_telephone, beneficiaire_groupe, beneficiaire_isole"
      )
      .order("date", { ascending: false })
      .limit(10000);
    setDossiers(data || []);
  }

  useEffect(() => {
    if (profile) charger();
  }, [profile]);

  const beneficiaires = useMemo(() => grouperBeneficiaires(dossiers), [dossiers]);
  const doublons = useMemo(() => doublonsSuggeres(beneficiaires), [beneficiaires]);

  if (erreurProfil) return <EcranErreurProfil message={erreurProfil} />;
  if (loading || !profile) return <EcranChargement />;

  const q = recherche.trim().toLowerCase();
  const qTel = normaliserTelephone(recherche);
  const qAdr = normaliserAdresse(recherche);
  const liste = beneficiaires
    .filter((b) => {
      if (fiche !== "Toutes" && !b.fiches.includes(fiche)) return false;
      if (statut !== "Tous" && b.dernier?.etat !== statut) return false;
      if (du && !b.dossiers.some((d) => d.date >= du)) return false;
      if (au && !b.dossiers.some((d) => d.date <= au)) return false;
      if (!q) return true;
      return (
        b.nom.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q) ||
        (b.siret && b.siret.includes(q.replace(/\s/g, ""))) ||
        (qTel.length >= 4 && normaliserTelephone(b.telephone).includes(qTel)) ||
        (qAdr.length >= 3 && normaliserAdresse(b.adresse).includes(qAdr)) ||
        b.dossiers.some((d) => d.nom_dossier?.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => String(b.dernier?.date || "").localeCompare(String(a.dernier?.date || "")));

  const benefOuvert = ouvert ? beneficiaires.find((b) => b.cle === ouvert) : null;

  async function fusionner(groupe) {
    const g = nouvelId();
    const ids = groupe.flatMap((b) => b.dossiers.map((d) => d.id));
    const { error } = await supabase.from("dossiers").update({ beneficiaire_groupe: g, beneficiaire_isole: false }).in("id", ids);
    if (error) return alert("Fusion impossible : " + error.message);
    charger();
  }

  async function separer(dossier) {
    if (!confirm(`Séparer le dossier « ${dossier.nom_dossier} » de ce bénéficiaire ?`)) return;
    const { error } = await supabase
      .from("dossiers")
      .update({ beneficiaire_groupe: nouvelId(), beneficiaire_isole: true })
      .eq("id", dossier.id);
    if (error) return alert("Séparation impossible : " + error.message);
    setOuvert(null);
    charger();
  }

  function exporter() {
    const feuille = XLSX.utils.json_to_sheet(
      liste.map((b) => ({
        "Nom / raison sociale": b.nom,
        SIRET: b.siret,
        Adresse: b.adresse,
        "E-mail": b.email,
        Téléphone: formatTelephone(b.telephone),
        "Nb dossiers": b.dossiers.length,
        Fiches: b.fiches.join(", "),
        "Dernier dossier": b.dernier?.nom_dossier,
        "Date dernier dossier": b.dernier?.date,
        "Statut dernier dossier": ETATS[b.dernier?.etat]?.court || b.dernier?.etat,
      }))
    );
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Bénéficiaires");
    XLSX.writeFile(classeur, `HILLSOLUTION_beneficiaires_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const sansFiche = dossiers.filter(
    (d) => !d.beneficiaire_nom && !d.beneficiaire_adresse && !d.beneficiaire_telephone && !d.beneficiaire_email && !d.beneficiaire_siret
  ).length;

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="users"
          titre="Bénéficiaires"
          sousTitre={`${beneficiaires.length} bénéficiaire(s) sur ${dossiers.length} dossier(s) — réservé à l'admin.`}
          actions={
            <button className="btn-secondary" onClick={exporter} disabled={!liste.length}>
              <Icon name="download" size={16} />
              Exporter {liste.length}
            </button>
          }
        />

        {sansFiche > 0 && (
          <div className="alert alert-info mb-4">
            <Icon name="info" size={16} className="mt-0.5" />
            <span>
              {sansFiche} dossier(s) n'ont pas encore de fiche bénéficiaire (dossiers antérieurs). Ils se complètent depuis la
              page Saisie ou Qualité.
            </span>
          </div>
        )}

        {doublons.length > 0 && (
          <div className="card mb-6 border-isoGold/40">
            <button className="card-header w-full text-left" onClick={() => setVoirDoublons((v) => !v)}>
              <span className="card-title">
                <Icon name="alert" size={15} className="text-isoGold-dark" />
                {doublons.length} doublon(s) suggéré(s) — même adresse, fiches séparées
              </span>
              <Icon name="chevronDown" size={16} className={`text-ink/40 ${voirDoublons ? "rotate-180" : ""}`} />
            </button>
            {voirDoublons && (
              <ul className="border-t border-line divide-y divide-line">
                {doublons.map((groupe) => (
                  <li key={groupe.map((b) => b.cle).join("|")} className="px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm min-w-0">
                      <p className="font-medium">{groupe[0].adresse}</p>
                      <p className="text-xs text-ink/55">
                        {groupe.map((b) => `${b.nom || "Sans nom"} (${b.dossiers.length} dossier${b.dossiers.length > 1 ? "s" : ""})`).join("  ·  ")}
                      </p>
                    </div>
                    <button className="btn-secondary btn-sm" onClick={() => fusionner(groupe)}>
                      <Icon name="layers" size={13} />
                      Fusionner
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="card p-4 mb-6 grid sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-3">
          <div className="field">
            <label className="label">Recherche</label>
            <div className="relative">
              <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/35 pointer-events-none" />
              <input
                className="input pl-9"
                placeholder="Nom, SIRET, adresse, téléphone, e-mail, dossier…"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label className="label">Fiche CEE</label>
            <select className="input" value={fiche} onChange={(e) => setFiche(e.target.value)}>
              <option>Toutes</option>
              {options.operations.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Statut du dernier dossier</label>
            <select className="input" value={statut} onChange={(e) => setStatut(e.target.value)}>
              <option>Tous</option>
              {Object.entries(ETATS)
                .filter(([k]) => !["En attente", "Dossier vérifié", "En cours de vérification"].includes(k))
                .map(([k, m]) => (
                  <option key={k} value={k}>
                    {m.court}
                  </option>
                ))}
            </select>
          </div>
          <div className="field">
            <label className="label">Dossier depuis le</label>
            <input type="date" className="input" value={du} onChange={(e) => setDu(e.target.value)} />
          </div>
          <div className="field">
            <label className="label">Jusqu'au</label>
            <input type="date" className="input" value={au} onChange={(e) => setAu(e.target.value)} />
          </div>
        </div>

        <div className="card overflow-x-auto">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Bénéficiaire</th>
                <th>Adresse</th>
                <th>Contact</th>
                <th className="!text-right">Dossiers</th>
                <th>Fiches</th>
                <th>Dernier dossier</th>
              </tr>
            </thead>
            <tbody>
              {liste.slice(0, 300).map((b) => (
                <tr key={b.cle} className="cursor-pointer" onClick={() => setOuvert(b.cle)}>
                  <td>
                    <span className="flex items-center gap-2 font-semibold">
                      <Avatar nom={b.nom || "?"} taille={26} />
                      <span className="min-w-0">
                        {b.nom || <span className="text-ink/40">Sans nom</span>}
                        {b.siret && <span className="block font-mono text-[11px] text-ink/45 font-normal">{b.siret}</span>}
                      </span>
                    </span>
                  </td>
                  <td className="text-ink/70 max-w-[260px]">{b.adresse || "—"}</td>
                  <td className="text-xs">
                    {b.telephone && <span className="block tabular">{formatTelephone(b.telephone)}</span>}
                    {b.email && <span className="block text-ink/55 break-all">{b.email}</span>}
                    {!b.telephone && !b.email && <span className="text-ink/30">—</span>}
                  </td>
                  <td className="text-right font-semibold tabular">{b.dossiers.length}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {b.fiches.map((f) => (
                        <span key={f} className="badge badge-brand">
                          {f}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className="text-xs text-ink/55 tabular block">{formatDate(b.dernier?.date)}</span>
                    <StatutBadge etat={b.dernier?.etat} />
                  </td>
                </tr>
              ))}
              {liste.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <EmptyState icone="users" texte="Aucun bénéficiaire pour ces critères." />
                  </td>
                </tr>
              )}
              {liste.length > 300 && (
                <tr>
                  <td colSpan={6} className="text-center text-xs text-ink/45 py-3">
                    300 premiers affichés sur {liste.length} — affine avec la recherche (l'export contient tout).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>

      {benefOuvert && (
        <Modal titre={benefOuvert.nom || "Bénéficiaire"} sousTitre={`${benefOuvert.dossiers.length} dossier(s)`} onFermer={() => setOuvert(null)} taille="lg">
          <div className="grid sm:grid-cols-2 gap-3 text-sm mb-6">
            {[
              ["SIRET", benefOuvert.siret],
              ["Téléphone", benefOuvert.telephone && formatTelephone(benefOuvert.telephone)],
              ["Adresse", benefOuvert.adresse],
              ["E-mail", benefOuvert.email],
            ].map(([l, v]) => (
              <div key={l}>
                <p className="eyebrow mb-0.5">{l}</p>
                <p className={v ? "" : "text-ink/35"}>{v || "—"}</p>
              </div>
            ))}
          </div>
          <p className="eyebrow mb-2">Dossiers</p>
          <div className="card divide-y divide-line">
            {benefOuvert.dossiers.map((d) => (
              <div key={d.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                <button className="text-left min-w-0" onClick={() => setHistorique(d)}>
                  <p className="font-semibold hover:text-brand-600">{d.nom_dossier}</p>
                  <p className="text-xs text-ink/50">
                    {formatDate(d.date)} · {d.nom_operation} · {d.ingenieur || "dans la file"}
                    {d.nb_retours ? ` · ${d.nb_retours} retour(s)` : ""}
                  </p>
                </button>
                <div className="flex items-center gap-2">
                  <StatutBadge etat={d.etat} />
                  {benefOuvert.dossiers.length > 1 && (
                    <button className="btn-ghost btn-xs" onClick={() => separer(d)} title="Ce dossier n'est pas ce bénéficiaire">
                      Séparer
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {historique && <HistoriqueComplet supabase={supabase} dossier={historique} onFermer={() => setHistorique(null)} />}
    </div>
  );
}
