"use client";
import { useState } from "react";
import TuilesCockpit from "@/components/TuilesCockpit";
import FiltrePeriode from "@/components/FiltrePeriode";
import Avatar from "@/components/ui/Avatar";
import { S } from "@/lib/constants";
import { serieCompte, septJours, jourLocal } from "@/lib/series";
import { bornes, bornesPrecedentes, dansBornes, libelleComparaison, libellePeriode } from "@/lib/periode";
import { ingenieurResponsable } from "@/lib/rapportQualite";
import { construireBase, resumePeriode, parIngenieur } from "@/lib/production";
import { formatDuree } from "@/lib/constants";

export const C_NOUVEAU = "#1F6FA8";
export const C_MODIF = "#E3A23B";
const T_MODIF = "#B7791F";
const C_AUDIT = "#3E8A2F";
const C_RI = "#A8700E";
const C_RC = "#C23A33";

export const estNouveau = (d) => d.nature_prod === "Nouveau dossier";
export const estModification = (d) => d.nature_prod === "Modification";
const estAudite = (d) => d.etat === S.VALIDE || d.etat === "Dossier vérifié" || d.etat === S.PAS_DE_MODIF;
const nomEgal = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/**
 * Retours d'une période : la table dossier_retours si elle existe, sinon les indicateurs des dossiers.
 * Renvoie [{ type: "interne" | "client", date, ingenieur, operation, client }]
 */
export function listeRetours(dossiers, retours) {
  const parId = Object.fromEntries(dossiers.map((d) => [d.id, d]));
  if (retours) {
    return retours.map((r) => {
      const d = parId[r.dossier_id];
      const type = r.type === "client" ? "client" : "interne";
      // Retour interne : imputé à l'ingénieur du dossier. Retour client : c'est une nouvelle modif,
      // créditée à l'ingénieur qui la traite (ingénieur de modif, sinon ingénieur du dossier).
      const fautif = r.ingenieur || (d && ingenieurResponsable(d));
      return { type, date: r.created_at, ingenieur: type === "client" ? (d ? ingenieurResponsable(d) : r.ingenieur) : fautif, operation: r.operation || d?.nom_operation, client: d?.client };
    });
  }
  const l = [];
  for (const d of dossiers) {
    if (d.retour_interne) l.push({ type: "interne", date: d.date_verification || d.date, ingenieur: ingenieurResponsable(d), operation: d.nom_operation, client: d.client });
    if (d.retour_client) l.push({ type: "client", date: d.date_retour_client || d.date, ingenieur: ingenieurResponsable(d), operation: d.nom_operation, client: d.client });
  }
  return l;
}

function ecart(a, b, comp, baisseBonne = false) {
  if (a === b) return { note: `= ${comp}`, ton: "neutre" };
  const d = a - b;
  const bon = baisseBonne ? d < 0 : d > 0;
  let txt;
  if (b > 0 && Math.abs(d) >= 10) txt = `${d > 0 ? "+" : "−"}${Math.round(Math.abs(d / b) * 100)} %`;
  else txt = `${d > 0 ? "+" : "−"}${Math.abs(d)}`;
  return { note: `${txt} ${comp}`, ton: bon ? "vert" : "rouge" };
}

const nf = (n) => n.toLocaleString("fr-FR");

/** Barre empilée Nouveaux / Modifications. */
function Repartition({ a, b, max, hauteur = 12 }) {
  const t = a + b;
  if (!t) return <span className="text-ink/25">—</span>;
  return (
    <span className="flex rounded-r overflow-hidden" style={{ height: hauteur, width: `${(t / max) * 100}%`, minWidth: 6 }} title={`${a} nouveau(x), ${b} modification(s)`}>
      <i className="block h-full" style={{ width: `${(a / t) * 100}%`, background: C_NOUVEAU }} />
      <i className="block h-full" style={{ width: `${(b / t) * 100}%`, background: C_MODIF }} />
    </span>
  );
}

export function Legende() {
  return (
    <span className="flex gap-4 text-xs text-ink/60">
      <span className="flex items-center gap-1.5">
        <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C_NOUVEAU }} />
        Nouveaux dossiers
      </span>
      <span className="flex items-center gap-1.5">
        <i className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: C_MODIF }} />
        Modifications
      </span>
    </span>
  );
}

/** Tableau « Production par ingénieur » avec son propre filtre (période + fiche). Calcul commun : lib/production.js */
function ProductionParIngenieur({ base, ingenieurs, operations, periodeHaut, ficheHaut }) {
  const [periode, setPeriode] = useState(null); // null = suit le filtre du haut
  const [fiche, setFiche] = useState(null);
  const p = periode || periodeHaut;
  const f = fiche || ficheHaut;
  const b = bornes(p);
  const ok = (d) => f === "Tous" || d?.nom_operation === f;
  const lignes = parIngenieur(base, (date) => dansBornes(date, b), ok, ingenieurs).sort((x, y) => y.total - x.total || y.ri - x.ri || x.nom.localeCompare(y.nom));
  const max = Math.max(1, ...lignes.map((l) => l.total));
  const tot = lignes.reduce((t, l) => ({ nv: t.nv + l.nv, md: t.md + l.md, ri: t.ri + l.ri, ar: t.ar + l.dossiersAvecRetour, rc: t.rc + l.rc }), { nv: 0, md: 0, ri: 0, ar: 0, rc: 0 });
  const r = resumePeriode(base, (date) => dansBornes(date, b), ok);

  return (
    <section className="card mb-6">
      <div className="card-header flex-wrap gap-3">
        <div>
          <p className="card-title">Production par ingénieur</p>
          <p className="text-xs text-ink/50 mt-0.5 first-letter:uppercase">
            {libellePeriode(p)} · {f === "Tous" ? "toutes les fiches" : f} · dossiers et modifs audités, chaque retour interne compte
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <FiltrePeriode valeur={p} onChange={setPeriode} />
          <select className="input input-sm w-48" value={f} onChange={(e) => setFiche(e.target.value)} aria-label="Fiche CEE du tableau">
            <option value="Tous">Toutes les fiches</option>
            {operations.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="px-5 pt-1 pb-2">
        <Legende />
      </div>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Ingénieur</th>
              <th className="text-right" title="Nouveaux dossiers audités">Nouveaux audités</th>
              <th className="text-right" title="Une par modif, quel que soit le nombre de retours internes">Modifs auditées</th>
              <th className="w-[18%]">Répartition</th>
              <th className="text-right">Total audité</th>
              <th className="text-right" title="Chaque retour interne compte (avant ou après audit)">Retours internes</th>
              <th className="text-right" title="Dossiers ayant eu au moins un retour interne">Dossiers avec retour</th>
              <th className="text-right" title="Dossiers audités sans aucun retour interne">1er coup</th>
              <th className="text-right" title="Demandes du client (pas une faute)">Retours client</th>
              <th className="text-right" title="Temps passé par dossier, pauses exclues">Temps moy.</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.cle}>
                <td>
                  <span className="flex items-center gap-2.5 font-medium capitalize whitespace-nowrap">
                    <Avatar nom={l.nom} taille={26} />
                    {l.nom}
                  </span>
                </td>
                <td className="text-right tabular font-medium" style={{ color: C_NOUVEAU }}>{l.nv}</td>
                <td className="text-right tabular font-medium" style={{ color: T_MODIF }}>{l.md}</td>
                <td>
                  <Repartition a={l.nv} b={l.md} max={max} hauteur={14} />
                </td>
                <td className="text-right tabular font-semibold">{l.total}</td>
                <td className="text-right tabular" style={{ color: l.ri ? C_RI : undefined, fontWeight: l.ri ? 600 : undefined }}>{l.ri}</td>
                <td className="text-right tabular text-ink/65">{l.dossiersAvecRetour}</td>
                <td className="text-right tabular whitespace-nowrap">{l.premierCoup === null ? "—" : `${l.premierCoup} %`}</td>
                <td className="text-right tabular" style={{ color: l.rc ? C_RC : undefined }}>{l.rc}</td>
                <td className="text-right tabular whitespace-nowrap text-ink/65">{l.tempsMoyen === null ? "—" : formatDuree(l.tempsMoyen)}</td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr>
                <td colSpan={10} className="table-empty">
                  Aucune production sur cette période.
                </td>
              </tr>
            )}
            {lignes.length > 0 && (
              <tr className="bg-paper/60 font-semibold">
                <td>Équipe</td>
                <td className="text-right tabular" style={{ color: C_NOUVEAU }}>{nf(tot.nv)}</td>
                <td className="text-right tabular" style={{ color: T_MODIF }}>{nf(tot.md)}</td>
                <td />
                <td className="text-right tabular">{nf(tot.nv + tot.md)}</td>
                <td className="text-right tabular" style={{ color: C_RI }}>{nf(tot.ri)}</td>
                <td className="text-right tabular">{nf(tot.ar)}</td>
                <td className="text-right tabular">{r.premierCoup === null ? "—" : `${r.premierCoup} %`}</td>
                <td className="text-right tabular" style={{ color: C_RC }}>{nf(tot.rc)}</td>
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Onglet « Vue d'ensemble » : 5 tuiles, production par ingénieur, volume par client. */
export default function VueEnsemble({ dossiers, retours, traitements = [], options, periode, fiche }) {
  const rets = listeRetours(dossiers, retours);
  const base = construireBase(dossiers, traitements, retours || []);
  const b = bornes(periode);
  const ok = (d) => fiche === "Tous" || d?.nom_operation === fiche;
  const c = resumePeriode(base, (date) => dansBornes(date, b), ok);
  const avant = resumePeriode(base, (date) => dansBornes(date, bornesPrecedentes(periode)), ok);
  const comp = libelleComparaison(periode);
  const dsF = dossiers.filter((d) => d.etat !== "Annulé" && ok(d));
  const rsF = rets.filter((r) => fiche === "Tous" || r.operation === fiche);

  // Mini graphiques des 7 derniers jours
  const jours7 = septJours();
  const parJour = (fn) => jours7.map((j) => fn((date) => jourLocal(date) === j));
  const serieRecus = parJour((dans) => { const x = resumePeriode(base, dans, ok); return x.recus.nv + x.recus.md; });
  const serieAudites = parJour((dans) => resumePeriode(base, dans, ok).audites.total);
  const seriePc = parJour((dans) => resumePeriode(base, dans, ok).premierCoup ?? 0);
  const totRecus = c.recus.nv + c.recus.md;

  const tuiles = [
    {
      label: "Reçus",
      split: [
        { label: "nouveaux", valeur: nf(c.recus.nv), couleur: C_NOUVEAU },
        { label: "modifs", valeur: nf(c.recus.md), couleur: T_MODIF },
      ],
      ...ecart(totRecus, avant.recus.nv + avant.recus.md, comp),
      serie: serieRecus,
      couleurSerie: ["#BBD4EA", C_NOUVEAU],
      actif: true,
      aide: "Travail reçu : nouveaux dossiers créés, modifs saisies et retours client (une modif chacun), le jour de la demande",
    },
    {
      label: "Audités",
      split: [
        { label: "nouveaux", valeur: nf(c.audites.nv), couleur: C_NOUVEAU },
        { label: "modifs", valeur: nf(c.audites.md), couleur: T_MODIF },
      ],
      ...ecart(c.audites.total, avant.audites.total, comp),
      serie: serieAudites,
      couleurSerie: ["#C7E1BF", C_AUDIT],
      aide: "Production : dossiers et modifs audités, comptés une fois le jour de l'audit, même après plusieurs retours internes",
    },
    { label: "Retours internes", valeur: nf(c.ri), note: c.tauxRI === null ? ecart(c.ri, avant.ri, comp, true).note : `${c.tauxRI} % des audités`, ton: c.ri ? "rouge" : "vert", serie: serieCompte(rsF, "date", (r) => r.type === "interne"), couleur: C_RI, couleurSerie: ["#EBD7AE", C_RI], aide: "Erreurs : chaque retour interne compte (avant ou après audit), imputé à l'ingénieur" },
    { label: "Validés du 1er coup", valeur: c.premierCoup === null ? "—" : `${c.premierCoup} %`, note: c.audites.total ? `${c.audites.total} audité(s)` : "", ton: "neutre", serie: seriePc, couleur: C_AUDIT, couleurSerie: ["#C7E1BF", C_AUDIT], aide: "Part des dossiers audités sans aucun retour interne" },
    { label: "Retours client", valeur: nf(c.rc), ...ecart(c.rc, avant.rc, comp, true), serie: serieCompte(rsF, "date", (r) => r.type === "client"), couleur: C_RC, couleurSerie: ["#F1C9C5", C_RC], aide: "Demandes du client : chacune devient une modif à traiter" },
  ];

  // Par client (période et fiche du haut)
  const parClient = {};
  for (const d of dsF) {
    if (!dansBornes(d.date, b)) continue;
    const k = d.client || "Sans client";
    parClient[k] = parClient[k] || { nv: 0, md: 0 };
    if (estNouveau(d)) parClient[k].nv += 1;
    else if (estModification(d)) parClient[k].md += 1;
  }
  // Chaque retour client compte comme une modif du client
  for (const r of rsF) {
    if (r.type !== "client" || !dansBornes(r.date, b)) continue;
    const k = r.client || "Sans client";
    parClient[k] = parClient[k] || { nv: 0, md: 0 };
    parClient[k].md += 1;
  }
  const clients = Object.entries(parClient)
    .map(([nom, v]) => ({ nom, ...v }))
    .filter((x) => x.nv + x.md > 0)
    .sort((x, y) => y.nv + y.md - (x.nv + x.md));
  const maxC = Math.max(1, ...clients.map((x) => x.nv + x.md));

  return (
    <>
      <TuilesCockpit cinq items={tuiles} />

      <ProductionParIngenieur
        base={base}
        ingenieurs={options.ingenieursAssignables?.length ? options.ingenieursAssignables : options.ingenieurs}
        operations={options.operations}
        periodeHaut={periode}
        ficheHaut={fiche}
      />

      <section className="card mb-6">
        <div className="card-header">
          <p className="card-title">Par client</p>
          <span className="text-xs text-ink/50 first-letter:uppercase">
            {libellePeriode(periode)} · {fiche === "Tous" ? "toutes les fiches" : fiche}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Client</th>
                <th className="text-right">Nouveaux</th>
                <th className="text-right">Modifs</th>
                <th className="text-right">Total</th>
                <th className="w-[40%]">Volume</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((x) => (
                <tr key={x.nom}>
                  <td className="font-medium">{x.nom}</td>
                  <td className="text-right tabular">{x.nv}</td>
                  <td className="text-right tabular">{x.md}</td>
                  <td className="text-right tabular font-semibold">{x.nv + x.md}</td>
                  <td>
                    <Repartition a={x.nv} b={x.md} max={maxC} />
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={5} className="table-empty">
                    Aucun dossier sur cette période.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
