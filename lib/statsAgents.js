// Statistiques agents (Tableau de bord → Statistiques agents).
//
// Règles :
//   · Un dossier compte dans la période où il est traité (audité par la Qualité, ou corrigé et
//     validé par l'ingénieur après un retour) — et non dans la période où il a été créé.
//   · Unités de production : le dossier lui-même (« nouveau dossier » ou « modification » selon sa nature)
//     + une « modification » pour chaque retour client, comptée quand cette modif est traitée.
//   · Un retour interne ne crée pas de nouvelle unité : un dossier revérifié après un retour interne
//     ne compte qu'une fois. Les retours internes / client sont affichés « dont ».
//   · Les retours comptent dans la période où ils ont été faits.
import { calculerStatsIngenieur } from "@/lib/scoring";
import { heuresTraitementFini } from "@/lib/tempsTraitement";
import { MOIS } from "@/lib/constants";

const cle = (n) => String(n || "").trim().toLowerCase();
const jour = (v) => (v ? new Date(v).toLocaleDateString("sv-SE") : "");
const estModifNature = (d) => String(d.nature_prod || "").toLowerCase().startsWith("modif");

/** Le jour (AAAA-MM-JJ) est-il dans la période des filtres (mois, année, du, au) ? */
export function dansFiltreDate(j, f) {
  if (!j) return false;
  if (f.du && j < f.du) return false;
  if (f.au && j > f.au) return false;
  if (f.annee !== "Tous" && Number(j.slice(0, 4)) !== Number(f.annee)) return false;
  if (f.mois !== "Tous" && MOIS[Number(j.slice(5, 7)) - 1] !== f.mois) return false;
  return true;
}

/**
 * Unités traitées : [{ dossier, date, nature: "nouveau" | "modif", ingenieur }]
 * traitements : [{ dossier_id, date }] (audits Qualité, validations par l'ingénieur, anciens audits)
 * retours : lignes de dossier_retours (non annulées)
 */
export function unitesTraitees(dossiers, traitements, retours) {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const parDossier = new Map();
  for (const t of traitements) {
    if (!parId.has(t.dossier_id) || !t.date) continue;
    if (!parDossier.has(t.dossier_id)) parDossier.set(t.dossier_id, []);
    parDossier.get(t.dossier_id).push(t.date);
  }
  const clients = new Map();
  for (const r of retours || []) {
    if (r.type !== "client") continue;
    if (!clients.has(r.dossier_id)) clients.set(r.dossier_id, []);
    clients.get(r.dossier_id).push(r.created_at);
  }
  const unites = [];
  for (const [id, dates] of parDossier) {
    const d = parId.get(id);
    dates.sort();
    const rc = (clients.get(id) || []).slice().sort();
    let precedent = null;
    for (const date of dates) {
      if (precedent === null) {
        // Premier traitement : le dossier lui-même
        unites.push({ dossier: d, date, nature: estModifNature(d) ? "modif" : "nouveau", ingenieur: estModifNature(d) ? d.ingenieur_modif || d.ingenieur : d.ingenieur });
        precedent = date;
        continue;
      }
      // Traitement suivant : une nouvelle modif seulement s'il y a eu un retour client entre-temps
      const p = precedent;
      if (rc.some((x) => x > p && x <= date)) {
        unites.push({ dossier: d, date, nature: "modif", ingenieur: d.ingenieur_modif || d.ingenieur });
        precedent = date;
      }
      // sinon : revérification après un retour interne → pas de nouvelle unité
    }
  }
  return unites;
}

/**
 * Lignes du tableau « Détail par ingénieur ».
 * dossiersFiltres : dossiers après les filtres fiche / client / ingénieur (sans filtre de date)
 */
export function statsParIngenieur({ dossiersFiltres, traitements, retours, filtres, objectifs, noms = [] }) {
  const ids = new Set(dossiersFiltres.map((d) => d.id));
  const unites = unitesTraitees(dossiersFiltres, traitements, retours).filter((u) => dansFiltreDate(jour(u.date), filtres));
  const rets = (retours || []).filter((r) => ids.has(r.dossier_id) && dansFiltreDate(jour(r.created_at), filtres));

  const affichage = new Map(noms.map((n) => [cle(n), n]));
  const groupes = new Map();
  const groupe = (n) => {
    const k = cle(n);
    if (!k || k === "—") return null;
    if (!affichage.has(k)) affichage.set(k, String(n).trim());
    if (!groupes.has(k)) groupes.set(k, { unites: [], retours: [] });
    return groupes.get(k);
  };
  for (const u of unites) groupe(u.ingenieur)?.unites.push(u);
  for (const r of rets) groupe(r.ingenieur)?.retours.push(r);
  if (filtres.ingenieur && filtres.ingenieur !== "Tous") {
    for (const k of [...groupes.keys()]) if (k !== cle(filtres.ingenieur)) groupes.delete(k);
  }

  const objectifsCle = Object.fromEntries(Object.entries(objectifs || {}).map(([k, v]) => [cle(k), v]));
  return [...groupes.entries()].map(([k, g]) => {
    // calculerStatsIngenieur compte nature « Nouveau dossier » / « Modification » parmi les dossiers « Audité »
    const pseudo = g.unites.map((u) => ({ etat: "Audité", nature_prod: u.nature === "modif" ? "Modification" : "Nouveau dossier" }));
    const stats = calculerStatsIngenieur(pseudo, objectifsCle[k], g.retours);
    const durees = [...new Set(g.unites.map((u) => u.dossier))].map(heuresTraitementFini).filter((h) => h !== null && h > 0 && h < 24 * 30);
    stats.tempsMoyenHeures = durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : null;
    return { ingenieur: affichage.get(k), objectif: objectifsCle[k], stats, retours: g.retours };
  });
}
