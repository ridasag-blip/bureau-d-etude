// Calcul commun de la production, des erreurs et des entrées.
// Utilisé par le tableau de bord (Vue d'ensemble, Production par ingénieur) et les Statistiques agents,
// pour que les chiffres soient les mêmes partout.
//
//   · Entrées : travail reçu — nouveaux dossiers créés, modifs demandées (modif saisie ou retour client),
//     le jour de la demande.
//   · Production : dossiers et modifs AUDITÉS (ou corrigés et validés par l'ingénieur), comptés une seule
//     fois le jour du traitement, même s'il y a eu plusieurs retours internes avant.
//     Chaque retour client traité = une modif de plus.
//   · Erreurs : chaque retour interne (avant ou après audit) compte, imputé à l'ingénieur qui a fait
//     le dossier, le jour du retour. Les retours levés ne comptent pas.
//   · Retours client : demandes du client (pas une faute), le jour du retour.
import { heuresTraitementFini } from "@/lib/tempsTraitement";
import { ingenieurResponsable } from "@/lib/rapportQualite";

const cle = (n) => String(n || "").trim().toLowerCase();
export const estModifNature = (d) => String(d?.nature_prod || "").toLowerCase().startsWith("modif");

/**
 * Prépare les données : unités produites (avec le nombre de retours internes de chacune) et retours normalisés.
 * traitements : [{ dossier_id, date }] (voir listeTraitements) ; retours : dossier_retours non annulés.
 */
export function construireBase(dossiers, traitements, retours) {
  const parId = new Map(dossiers.map((d) => [d.id, d]));

  const rets = [];
  for (const r of retours || []) {
    const d = parId.get(r.dossier_id);
    if (!d) continue;
    const type = r.type === "client" ? "client" : "interne"; // « qualite » (après audit) = retour interne
    rets.push({ dossier_id: r.dossier_id, dossier: d, type, apresAudit: r.type === "qualite", date: r.created_at, ingenieur: r.ingenieur || ingenieurResponsable(d), cause: r.cause });
  }
  const retsParDossier = new Map();
  for (const r of rets) {
    if (!retsParDossier.has(r.dossier_id)) retsParDossier.set(r.dossier_id, []);
    retsParDossier.get(r.dossier_id).push(r);
  }

  const traitParDossier = new Map();
  for (const t of traitements || []) {
    if (!parId.has(t.dossier_id) || !t.date) continue;
    if (!traitParDossier.has(t.dossier_id)) traitParDossier.set(t.dossier_id, []);
    traitParDossier.get(t.dossier_id).push(t.date);
  }

  const unites = [];
  for (const [id, dates] of traitParDossier) {
    const d = parId.get(id);
    dates.sort();
    const rs = retsParDossier.get(id) || [];
    const clients = rs.filter((r) => r.type === "client").map((r) => r.date).sort();
    const siennes = [];
    let precedent = null;
    for (const date of dates) {
      if (precedent === null) {
        siennes.push({ dossier: d, date, nature: estModifNature(d) ? "modif" : "nouveau", ingenieur: estModifNature(d) ? d.ingenieur_modif || d.ingenieur : d.ingenieur, nbRI: 0 });
        precedent = date;
      } else if (clients.some((x) => x > precedent && x <= date)) {
        // Un retour client entre deux traitements : une nouvelle modif
        siennes.push({ dossier: d, date, nature: "modif", ingenieur: d.ingenieur_modif || d.ingenieur, nbRI: 0 });
        precedent = date;
      }
      // sinon : revérification après un retour interne → pas de nouvelle unité
    }
    // Rattache chaque retour interne à son unité : avant audit → l'unité suivante ; après audit → l'unité audité juste avant
    for (const r of rs.filter((x) => x.type === "interne")) {
      let u = r.apresAudit ? [...siennes].reverse().find((s) => s.date <= r.date) : siennes.find((s) => s.date >= r.date);
      if (!u) u = r.apresAudit ? siennes[0] : siennes[siennes.length - 1];
      if (u) u.nbRI += 1;
    }
    unites.push(...siennes);
  }
  return { dossiers, unites, retours: rets };
}

/** Chiffres d'une période. dans(dateISO) → bool ; ok(dossier) → bool (fiche, client…). */
export function resumePeriode(base, dans, ok = () => true) {
  const ds = base.dossiers.filter((d) => d.etat !== "Annulé" && ok(d));
  const rs = base.retours.filter((r) => ok(r.dossier) && dans(r.date));
  const us = base.unites.filter((u) => ok(u.dossier) && dans(u.date));
  const ri = rs.filter((r) => r.type === "interne").length;
  const rc = rs.filter((r) => r.type === "client").length;
  const total = us.length;
  return {
    recus: {
      nv: ds.filter((d) => !estModifNature(d) && dans(d.date)).length,
      md: ds.filter((d) => estModifNature(d) && dans(d.date)).length + rc,
    },
    audites: { nv: us.filter((u) => u.nature === "nouveau").length, md: us.filter((u) => u.nature === "modif").length, total },
    ri,
    rc,
    tauxRI: total ? Math.round((ri / total) * 100) : null,
    premierCoup: total ? Math.round((us.filter((u) => u.nbRI === 0).length / total) * 100) : null,
  };
}

/** Une ligne par ingénieur : production, erreurs, 1er coup, retours client, temps moyen. */
export function parIngenieur(base, dans, ok = () => true, noms = []) {
  const affichage = new Map(noms.map((n) => [cle(n), n]));
  const g = new Map();
  const ligne = (n) => {
    const k = cle(n);
    if (!k || k === "—") return null;
    if (!affichage.has(k)) affichage.set(k, String(n).trim());
    if (!g.has(k)) g.set(k, { unites: [], retours: [] });
    return g.get(k);
  };
  for (const n of noms) ligne(n);
  for (const u of base.unites) if (ok(u.dossier) && dans(u.date)) ligne(u.ingenieur)?.unites.push(u);
  for (const r of base.retours) if (ok(r.dossier) && dans(r.date)) ligne(r.ingenieur)?.retours.push(r);

  return [...g.entries()].map(([k, x]) => {
    const ri = x.retours.filter((r) => r.type === "interne");
    const total = x.unites.length;
    const durees = [...new Set(x.unites.map((u) => u.dossier))].map(heuresTraitementFini).filter((h) => h !== null && h > 0 && h < 24 * 30);
    return {
      cle: k,
      nom: affichage.get(k),
      nv: x.unites.filter((u) => u.nature === "nouveau").length,
      md: x.unites.filter((u) => u.nature === "modif").length,
      total,
      ri: ri.length,
      dossiersAvecRetour: new Set(ri.map((r) => r.dossier_id)).size,
      premierCoup: total ? Math.round((x.unites.filter((u) => u.nbRI === 0).length / total) * 100) : null,
      rc: x.retours.filter((r) => r.type === "client").length,
      tempsMoyen: durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : null,
      retours: x.retours,
    };
  });
}
