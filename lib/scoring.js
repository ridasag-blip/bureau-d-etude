// ============================================================
// Logique de calcul des scores — reprend fidèlement les formules
// de la feuille STATISTIQUES du classeur Excel d'origine.
// ============================================================

/**
 * Score Qualité (/50) — proportionnel au taux de retour
 * Ne compte que les retours INTERNES (faute imputable à l'ingénieur) —
 * un retour client (modification demandée après coup) n'est pas une faute
 * qualité de l'ingénieur, donc ne pénalise pas ce score.
 * Excel (originel): MAX(0, 50 * (1 - retours / dossiers_traités))
 */
export function scoreQualite(dossiersTraites, retoursInternesUniquement) {
  if (!dossiersTraites || dossiersTraites === 0) return null; // "" dans Excel
  return Math.max(0, 50 * (1 - retoursInternesUniquement / dossiersTraites));
}

/**
 * Statut d'atteinte d'objectif
 * Excel: Atteint / Partiellement atteint / Non atteint / N/A
 */
export function statutAtteinteObjectif(nvDossierTraite, modifTraite, objectifNv, objectifModif) {
  const objNv = objectifNv || 0;
  const objModif = objectifModif || 0;
  if (objNv === 0 && objModif === 0) return "N/A";
  const atteintNv = nvDossierTraite >= objNv;
  const atteintModif = modifTraite >= objModif;
  if (atteintNv && atteintModif) return "Atteint";
  if (atteintNv || atteintModif) return "Partiellement atteint";
  return "Non atteint";
}

/**
 * Score Productivité (/50)
 * Excel: 50 si Atteint, 25 si Partiellement atteint, 0 si Non atteint, "" si N/A
 */
export function scoreProductivite(statut) {
  if (statut === "Atteint") return 50;
  if (statut === "Partiellement atteint") return 25;
  if (statut === "Non atteint") return 0;
  return null;
}

/**
 * Score Global (/100)
 */
export function scoreGlobal(qualite, productivite) {
  if (qualite === null || productivite === null) return null;
  return qualite + productivite;
}

/**
 * Agrège les dossiers d'un ingénieur sur une période filtrée et
 * calcule l'ensemble des indicateurs STATISTIQUES.
 */
export function calculerStatsIngenieur(dossiersIngenieur, objectif) {
  const nvDossierTraite = dossiersIngenieur.filter(
    (d) => d.nature_prod === "Nouveau dossier"
  ).length;

  const modifTraite = dossiersIngenieur.filter(
    (d) => d.nature_prod === "Modification" || d.ingenieur_modif // reassignation
  ).length;

  const dossierTraiteTotal = nvDossierTraite + modifTraite;

  const nbRetourInterne = dossiersIngenieur.filter((d) => d.retour_interne).length;
  const nbRetourClient = dossiersIngenieur.filter((d) => d.retour_client).length;
  const nbRetourTotal = nbRetourInterne + nbRetourClient;

  const statut = statutAtteinteObjectif(
    nvDossierTraite,
    modifTraite,
    objectif?.objectif_nv_dossier,
    objectif?.objectif_modif
  );

  // Seule la faute interne (imputable) pénalise le score qualité ;
  // un retour client (modif demandée) est suivi séparément, sans pénaliser.
  const qualite = scoreQualite(dossierTraiteTotal, nbRetourInterne);
  const productivite = scoreProductivite(statut);
  const global = scoreGlobal(qualite, productivite);

  // Délai moyen de traitement (idée bonus)
  const delais = dossiersIngenieur
    .map((d) => d.delai_traitement_jours)
    .filter((v) => v !== null && v !== undefined);
  const delaiMoyen = delais.length
    ? delais.reduce((a, b) => a + Number(b), 0) / delais.length
    : null;

  // Dossiers à risque (double faute) (idée bonus)
  const dossiersARisque = dossiersIngenieur.filter((d) => d.dossier_a_risque).length;

  return {
    nvDossierTraite,
    modifTraite,
    dossierTraiteTotal,
    nbRetourInterne,
    nbRetourClient,
    nbRetourTotal,
    statutAtteinte: statut,
    scoreQualite: qualite,
    scoreProductivite: productivite,
    scoreGlobal: global,
    delaiMoyenJours: delaiMoyen,
    dossiersARisque,
  };
}

/** Regroupe les dossiers par ingénieur */
export function grouperParIngenieur(dossiers) {
  const map = {};
  for (const d of dossiers) {
    if (!map[d.ingenieur]) map[d.ingenieur] = [];
    map[d.ingenieur].push(d);
  }
  return map;
}

/** Top N causes de retour (interne + client confondues) — pour le graphique bonus */
export function topCausesRetour(dossiers, n = 5) {
  const counts = {};
  for (const d of dossiers) {
    if (d.retour_interne && d.cause_retour_interne) {
      counts[d.cause_retour_interne] = (counts[d.cause_retour_interne] || 0) + 1;
    }
    if (d.retour_client && d.cause_retour_client) {
      counts[d.cause_retour_client] = (counts[d.cause_retour_client] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([cause, total]) => ({ cause, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, n);
}

/**
 * Temps moyen (en heures) entre la soumission d'un dossier par l'ingénieur
 * (« Envoyer pour vérification ») et sa vérification par la Qualité —
 * objectif cible ~1h. Ne se base pas sur l'assignation initiale, qui inclut
 * le temps de traitement de l'ingénieur (non pertinent pour ce SLA).
 */
export function delaiMoyenVerification(dossiers) {
  const delais = dossiers
    .filter((d) => d.date_soumission && d.date_verification)
    .map((d) => (new Date(d.date_verification) - new Date(d.date_soumission)) / 3600000);
  if (!delais.length) return null;
  return delais.reduce((a, b) => a + b, 0) / delais.length;
}

/** Dossiers marqués comme récurrents (2 retours ou plus, toute cause confondue) */
export function dossiersRecurrents(dossiers) {
  return dossiers.filter((d) => d.recurrent);
}

/** Charge actuelle par ingénieur : dossiers assignés pas encore terminés (en attente d'acceptation + en cours) */
export function chargeParIngenieur(dossiers) {
  const counts = {};
  for (const d of dossiers) {
    if (["En attente de traitement", "Encours"].includes(d.etat)) {
      counts[d.ingenieur] = (counts[d.ingenieur] || 0) + 1;
    }
  }
  return counts;
}

/** Détection de doublons potentiels par nom de dossier (bonus) */
export function detecterDoublons(dossiers) {
  const seen = {};
  const doublons = [];
  for (const d of dossiers) {
    const key = (d.nom_dossier || "").trim().toUpperCase();
    if (!key) continue;
    if (seen[key]) {
      doublons.push({ nomDossier: d.nom_dossier, ids: [seen[key], d.id] });
    } else {
      seen[key] = d.id;
    }
  }
  return doublons;
}
