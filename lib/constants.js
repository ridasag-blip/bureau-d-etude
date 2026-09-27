export const ROLES = {
  ADMIN: "admin",
  INGENIEUR: "ingenieur",
  QUALITE: "qualite",
};

export const ROLE_LABELS = {
  admin: "Admin",
  ingenieur: "Ingénieur",
  qualite: "Qualité",
};

export const MOIS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

/**
 * Tons sémantiques partagés par toute l'app (badges, KPI, graphiques).
 * brand = en cours / information · gold = attente · green = validé · red = problème
 */
export const TON_HEX = {
  neutral: "#8A96A3",
  brand: "#1F6FA8",
  green: "#4E9F3D",
  gold: "#D09A2E",
  red: "#D33A3A",
  dark: "#7A2E2E",
};

/**
 * Référentiel UNIQUE des états de dossier : libellé court affiché + ton.
 * Utilisé par StatutBadge, les tableaux, le pipeline Qualité et les KPI.
 */
export const ETATS = {
  "En attente de traitement": { court: "Pas encore accepté", ton: "neutral" },
  "En attente": { court: "En attente", ton: "neutral" },
  Encours: { court: "Ingénieur en cours", ton: "brand" },
  "En attente de vérification": { court: "À vérifier", ton: "gold" },
  "En cours de vérification": { court: "En vérification", ton: "brand" },
  "Audité": { court: "Audité", ton: "green" },
  "Dossier vérifié": { court: "Vérifié", ton: "green" },
  Suspendue: { court: "Suspendue", ton: "red" },
  "en pause": { court: "En pause", ton: "gold" },
  "Annulé": { court: "Annulé", ton: "neutral" },
};

/** Compatibilité : couleur hex par état (dérivée du référentiel ci-dessus). */
export const ETAT_COULEURS = Object.fromEntries(
  Object.entries(ETATS).map(([etat, m]) => [etat, TON_HEX[m.ton]])
);

/** Référentiel UNIQUE des événements de l'historique d'un dossier. */
export const EVENEMENTS = {
  assignation: { texte: "Assigné", ton: "brand" },
  acceptation: { texte: "Accepté par l'ingénieur", ton: "brand" },
  soumission_verification: { texte: "Envoyé pour vérification", ton: "gold" },
  prise_en_charge: { texte: "Pris en charge par la Qualité", ton: "brand" },
  verification_ok: { texte: "Vérifié — Audité", ton: "green" },
  retour_interne_avant_audit: { texte: "Retour interne (avant audit)", ton: "gold" },
  retour_interne_apres_audit: { texte: "Retour interne (après audit)", ton: "red" },
  retour_client: { texte: "Retour client (modif. demandée)", ton: "red" },
  reassignation: { texte: "Réassigné", ton: "brand" },
  changement_statut_manuel: { texte: "Statut modifié manuellement", ton: "neutral" },
};

export const SEUIL_ALERTE_JOURS_ENCOURS_VERIF = 5;

/** Initiales pour les avatars (« fatma ben ali » → « FB »). */
export function initiales(nom) {
  if (!nom) return "?";
  return nom
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

/** Date ISO (AAAA-MM-JJ) → « 12 sept. 2026 ». */
export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

/** Durée en heures → « 45 min », « 3,2 h », « 2 j 4 h ». */
export function formatDuree(heures) {
  if (heures === null || heures === undefined || isNaN(heures)) return "—";
  if (heures < 1) return `${Math.max(1, Math.round(heures * 60))} min`;
  if (heures < 48) return `${heures.toFixed(1).replace(".", ",")} h`;
  const j = Math.floor(heures / 24);
  const h = Math.round(heures % 24);
  return h ? `${j} j ${h} h` : `${j} j`;
}
