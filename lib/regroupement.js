// Regroupement des passages d'un même dossier (affichage seulement : les données ne changent pas).
//
// Un dossier revenu en modification par la Saisie ou un import crée une nouvelle ligne (un « passage »).
// Deux lignes sont le même dossier si elles ont le même nom, le même client et la même fiche CEE
// (sans tenir compte des majuscules ni des espaces). Les listes affichent une seule ligne par dossier,
// et l'historique réunit tous les passages. Les statistiques restent comptées par passage.
import { S, dateDerniereModif } from "@/lib/constants";
import { cleBase, indexUnites, nomBase, numVersion } from "@/lib/versions";

const norm = (v) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();

/** Clé d'un dossier : nom (sans suffixe de version -v1/-v2) + client + fiche CEE. */
export const cleDossier = cleBase;

/** Nom affiché pour la ligne regroupée : sans le suffixe de version. */
export const nomAffiche = (d) => nomBase(d?.nom_dossier);

// Passages encore en travail : ils passent devant les passages terminés pour représenter le dossier
const ACTIFS = [S.FILE, S.ASSIGNE, S.EN_COURS, "en pause", S.ATTENTE_INFO, S.A_CONTROLER, S.VERIF];
const ordreDate = (d) => `${dateDerniereModif(d)}|${String(d.created_at || "")}`;

/** Map(clé → passages triés du plus ancien au plus récent). */
export function grouperPassages(dossiers) {
  const g = new Map();
  for (const d of dossiers || []) {
    if (!norm(d.nom_dossier)) continue;
    const k = cleDossier(d);
    if (!g.has(k)) g.set(k, []);
    g.get(k).push(d);
  }
  for (const l of g.values()) l.sort((a, b) => ordreDate(a).localeCompare(ordreDate(b)));
  return g;
}

/** Le passage a est-il un meilleur représentant que b : actif d'abord ; entre deux actifs, le moins avancé
 *  (une version encore à contrôler l'emporte sur une version auditée) ; sinon le plus récent. */
function meilleur(a, b) {
  const ia = ACTIFS.indexOf(a.etat), ib = ACTIFS.indexOf(b.etat);
  if ((ia >= 0) !== (ib >= 0)) return ia >= 0;
  if (ia >= 0 && ib >= 0 && ia !== ib) return ia < ib;
  return ordreDate(a) > ordreDate(b);
}

/**
 * Une seule ligne par dossier, dans l'ordre de la liste d'origine.
 * lignes : lignes déjà filtrées / triées ; le représentant est choisi parmi elles.
 */
export function regrouperLignes(lignes) {
  const choisi = new Map();
  for (const d of lignes) {
    const k = cleDossier(d);
    const c = choisi.get(k);
    if (!c || meilleur(d, c)) choisi.set(k, d);
  }
  const vus = new Set();
  const res = [];
  for (const d of lignes) {
    const k = cleDossier(d);
    if (vus.has(k)) continue;
    vus.add(k);
    res.push(choisi.get(k));
  }
  return res;
}

/** Infos des pastilles : versions (V1, V2…), passages (modifs) et ingénieurs différents. */
export function infoPassages(d, groupes) {
  const l = groupes.get(cleDossier(d)) || [d];
  const ings = new Set(l.map((x) => norm(x.ingenieur_modif || x.ingenieur)).filter(Boolean));
  const idx = indexUnites(l);
  const unites = new Set(l.map((x) => idx.get(x.id)?.cle));
  const versions = Math.max(1, ...l.map((x) => idx.get(x.id)?.versions || 1));
  const aSuffixe = l.some((x) => numVersion(x.nom_dossier) !== null); // une ligne sans suffixe est alors la V1
  const nums = [...new Set(l.map((x) => numVersion(x.nom_dossier) ?? (aSuffixe ? 1 : null)).filter((n) => n !== null))].sort((a, b) => a - b);
  return { n: unites.size, lignes: l.length, versions: Math.max(versions, nums.length), numeros: nums, ingenieurs: ings.size, passages: l };
}

/** Pastille des versions : « 2 versions · V1 + V2 ». */
export function libelleVersions(info) {
  if (!info || info.versions < 2) return "";
  const nums = info.numeros?.length >= 2 ? info.numeros : Array.from({ length: info.versions }, (_, i) => i + 1);
  return `${info.versions} versions · ${nums.map((n) => `V${n}`).join(" + ")}`;
}

/** Pastille des passages : « 3 passages · 2 ingénieurs ». */
export function libellePassages(info) {
  if (!info) return "";
  const parts = [];
  if (info.n > 1) parts.push(`${info.n} passages`);
  if (info.ingenieurs > 1 && (info.n > 1 || info.versions > 1)) parts.push(`${info.ingenieurs} ingénieurs`);
  return parts.join(" · ");
}
