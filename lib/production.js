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
//   · Dossier en plusieurs versions (V1, V2… ou « Nombre de versions ») : 1 seul dossier produit,
//     compté quand la dernière version est auditée ; son temps est comparé par version.
import { heuresTraitementFini } from "@/lib/tempsTraitement";
import { ingenieurResponsable } from "@/lib/rapportQualite";
import { indexUnites } from "@/lib/versions";

const cle = (n) => String(n || "").trim().toLowerCase();
export const estModifNature = (d) => String(d?.nature_prod || "").toLowerCase().startsWith("modif");

/**
 * Prépare les données : unités produites (avec le nombre de retours internes de chacune) et retours normalisés.
 * traitements : [{ dossier_id, date }] (voir listeTraitements) ; retours : dossier_retours non annulés.
 */
export function construireBase(dossiers, traitements, retours) {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  const idx = indexUnites(dossiers);
  const cleU = (id) => idx.get(id)?.cle ?? id;

  const rets = [];
  for (const r of retours || []) {
    const d = parId.get(r.dossier_id);
    if (!d) continue;
    const type = r.type === "client" ? "client" : "interne"; // « qualite » (après audit) = retour interne
    rets.push({ dossier_id: r.dossier_id, unite: cleU(r.dossier_id), dossier: d, type, apresAudit: r.type === "qualite", date: r.created_at, ingenieur: r.ingenieur || ingenieurResponsable(d), cause: r.cause });
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

  const parLigne = new Map();
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
    parLigne.set(id, siennes);
  }

  // Versions d'un même dossier : la k-ième unité de chaque version forme une seule unité
  const unites = [];
  const faits = new Set();
  for (const [id, siennes] of parLigne) {
    const info = idx.get(id) || { cle: id, membres: [parId.get(id)], versions: 1 };
    if (faits.has(info.cle)) continue;
    faits.add(info.cle);
    const listes = info.membres.map((m) => parLigne.get(m.id) || []);
    const n = Math.max(...listes.map((l) => l.length));
    const heures = info.membres.map(heuresTraitementFini).filter((h) => h !== null && h > 0 && h < 24 * 30);
    for (let k = 0; k < n; k++) {
      const parts = listes.map((l) => l[k]).filter(Boolean);
      const base = parts[0];
      unites.push({
        ...base,
        date: parts.map((p) => p.date).sort().pop(), // comptée quand la dernière version est auditée
        nbRI: parts.reduce((a, p) => a + p.nbRI, 0),
        cle: info.cle,
        membres: info.membres,
        versions: info.versions,
        heures: heures.length ? heures.reduce((a, b) => a + b, 0) : null,
      });
    }
  }
  return { dossiers, unites, retours: rets, idx };
}

/** Nombre de dossiers distincts (les versions V1, V2… d'un même dossier comptent pour 1). */
function unique(ds, idx) {
  return new Set(ds.map((d) => idx?.get(d.id)?.cle ?? d.id)).size;
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
      nv: unique(ds.filter((d) => !estModifNature(d) && dans(d.date)), base.idx),
      md: unique(ds.filter((d) => estModifNature(d) && dans(d.date)), base.idx) + rc,
    },
    audites: { nv: us.filter((u) => u.nature === "nouveau").length, md: us.filter((u) => u.nature === "modif").length, total, multi: us.filter((u) => u.versions > 1).length },
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
    // Temps comparé par version : un dossier en 2 versions de 8 h = 4 h par version
    const vus = new Map();
    for (const u of x.unites) if (u.heures !== null && u.heures !== undefined) vus.set(u.cle, u.heures / Math.max(1, u.versions || 1));
    const durees = [...vus.values()];
    return {
      cle: k,
      nom: affichage.get(k),
      nv: x.unites.filter((u) => u.nature === "nouveau").length,
      md: x.unites.filter((u) => u.nature === "modif").length,
      total,
      ri: ri.length,
      dossiersAvecRetour: new Set(ri.map((r) => r.unite ?? r.dossier_id)).size,
      multi: x.unites.filter((u) => u.versions > 1).length,
      premierCoup: total ? Math.round((x.unites.filter((u) => u.nbRI === 0).length / total) * 100) : null,
      rc: x.retours.filter((r) => r.type === "client").length,
      tempsMoyen: durees.length ? durees.reduce((a, b) => a + b, 0) / durees.length : null,
      retours: x.retours,
    };
  });
}
