// Vérifications de la Qualité : chaque audit compte, même quand un même dossier revient
// (retour client, nouvelle modification) et est vérifié une deuxième ou une troisième fois.
// Source : l'historique (événements « Validé » et « retour levé, dossier validé »).
// Les anciens dossiers sans historique comptent une fois, avec leur date d'audit.

// Audit = le contrôleur valide le dossier. Vérification = chaque contrôle, qu'il finisse en audit ou en retour interne.
export const TYPES_AUDIT = ["verification_ok", "retour_annule"];
export const TYPES_VERIFICATION = [...TYPES_AUDIT, "retour_interne_avant_audit", "retour_interne_apres_audit"];

/** Lit les événements d'audit depuis une date, par pages de 1000 (limite Supabase). */
export async function chargerVerifications(supabase, depuisISO, types = TYPES_VERIFICATION) {
  const lignes = [];
  for (let page = 0; page < 50; page++) {
    const { data, error } = await supabase
      .from("dossier_evenements")
      .select("id, dossier_id, type, effectue_par_nom, created_at")
      .in("type", types)
      .gte("created_at", depuisISO)
      .order("created_at", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) return null;
    lignes.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return lignes;
}

/**
 * Liste des vérifications [{ dossier_id, date, par, dossier }] :
 * les événements d'audit, plus les dossiers audités qui n'ont aucun événement (données anciennes).
 */
export function listeVerifications(dossiers, evenements, { avecRetours = false } = {}) {
  const parId = new Map(dossiers.map((d) => [d.id, d]));
  // Dossiers validés par l'ingénieur lui-même après un retour : ce n'est pas un audit de la Qualité
  const ancien = (d) => d.date_verification && !d.valide_par_ingenieur;
  if (!evenements) {
    return dossiers.filter(ancien).map((d) => ({ dossier_id: d.id, date: d.date_verification, par: d.valide_par || "", dossier: d, audit: true }));
  }
  const evts = evenements.filter((e) => avecRetours || TYPES_AUDIT.includes(e.type));
  const avecEvt = new Set(evenements.filter((e) => TYPES_AUDIT.includes(e.type)).map((e) => e.dossier_id));
  const liste = evts.map((e) => ({
    dossier_id: e.dossier_id,
    date: e.created_at,
    par: e.effectue_par_nom || parId.get(e.dossier_id)?.valide_par || "",
    dossier: parId.get(e.dossier_id) || null,
    audit: TYPES_AUDIT.includes(e.type),
  }));
  // Données anciennes (importées, sans historique) : un audit à la date d'audit du dossier
  for (const d of dossiers) {
    if (ancien(d) && !avecEvt.has(d.id) && d.etat !== "Annulé") liste.push({ dossier_id: d.id, date: d.date_verification, par: d.valide_par || "", dossier: d, audit: true });
  }
  return liste;
}

/** Début de l'année précédente : assez d'historique pour les filtres Mois / Année et les comparaisons. */
export function debutHistorique() {
  const a = new Date().getFullYear() - 1;
  return new Date(a, 0, 1).toISOString();
}

// « Audités » au sens du statut : dossiers dont la qualification est « Audité », audités par la Qualité
// sur la période. Un dossier ne compte qu'une fois par période (les revérifications sont dans « Mes contrôles »).
const ETATS_AUDITE = ["Audité", "Dossier vérifié"];
export function nbDossiersAudites(liste, dans) {
  const ids = new Set();
  for (const v of liste) if (v.audit && v.dossier && ETATS_AUDITE.includes(v.dossier.etat) && dans(v.date)) ids.add(v.dossier_id);
  return ids.size;
}

/** Même calcul, jour par jour sur les 7 derniers jours (mini graphique des tuiles). */
export function serieDossiersAudites(liste) {
  const jours = Array.from({ length: 7 }, (_, i) => new Date(Date.now() - (6 - i) * 86400000).toLocaleDateString("sv-SE"));
  return jours.map((j) => nbDossiersAudites(liste, (date) => new Date(date).toLocaleDateString("sv-SE") === j));
}
