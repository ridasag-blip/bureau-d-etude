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
import { construireBase, parIngenieur } from "@/lib/production";
import { MOIS } from "@/lib/constants";

const cle = (n) => String(n || "").trim().toLowerCase();
const jour = (v) => (v ? new Date(v).toLocaleDateString("sv-SE") : "");

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
 * Lignes du tableau « Détail par ingénieur » (calcul commun : lib/production.js).
 * dossiersFiltres : dossiers après les filtres fiche / client / ingénieur (sans filtre de date)
 *
 * Score global /100 = Qualité /50 + Quantité /50
 *   · Qualité  = 50 × (1 − retours internes ÷ dossiers traités) : chaque retour interne pénalise.
 *   · Quantité = 50 × traités ÷ objectif (si un objectif est saisi), sinon 50 × traités ÷ meilleur total
 *     de l'équipe sur la période. Une modif compte comme un nouveau dossier.
 */
export function statsParIngenieur({ dossiersFiltres, traitements, retours, filtres, objectifs, noms = [] }) {
  const base = construireBase(dossiersFiltres, traitements, retours);
  const dans = (date) => dansFiltreDate(jour(date), filtres);
  let lignes = parIngenieur(base, dans, () => true, noms).filter((l) => l.total > 0 || l.retours.length > 0);
  if (filtres.ingenieur && filtres.ingenieur !== "Tous") lignes = lignes.filter((l) => l.cle === cle(filtres.ingenieur));
  const objectifsCle = Object.fromEntries(Object.entries(objectifs || {}).map(([k, v]) => [cle(k), v]));
  const meilleur = Math.max(0, ...lignes.map((l) => l.total));
  return lignes.map((l) => {
    const objectif = objectifsCle[l.cle];
    const cible = objectif ? (Number(objectif.objectif_nv_dossier) || 0) + (Number(objectif.objectif_modif) || 0) : 0;
    const qualite = l.total ? Math.max(0, 50 * (1 - l.ri / l.total)) : null;
    const quantite = cible > 0 ? Math.min(50, (50 * l.total) / cible) : meilleur > 0 ? (50 * l.total) / meilleur : null;
    return {
      ingenieur: l.nom,
      objectif,
      retours: l.retours,
      stats: {
        nvDossierTraite: l.nv,
        modifTraite: l.md,
        dossierTraiteTotal: l.total,
        nbRetourInterne: l.ri,
        dossiersAvecRetour: l.dossiersAvecRetour,
        premierCoup: l.premierCoup,
        nbRetourClient: l.rc,
        tempsMoyenHeures: l.tempsMoyen,
        quantiteSur: cible > 0 ? "objectif" : "équipe",
        scoreQualite: qualite,
        scoreQuantite: quantite,
        scoreGlobal: qualite === null || quantite === null ? null : qualite + quantite,
      },
    };
  });
}
