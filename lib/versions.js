// Dossiers en plusieurs versions (V1, V2…).
//
// Deux façons de les saisir, toutes deux reconnues :
//   · une seule ligne avec « Nombre de versions » = 2 (champ dossiers.nb_versions, migration V35) ;
//   · une ligne par version, avec un suffixe dans le nom : « …num 5-v1 » / « …num 5-v2 »
//     (aussi « V1 », « _V2 », « (V2) », « V 2 »), même client, même fiche.
// Un dossier en plusieurs versions compte pour 1 dossier (facturation, statistiques), mais il est
// signalé partout ; son temps est comparé par version et son délai est multiplié par le nombre de versions.

const SUFFIXE = /(?:[\s\-_]+\(?|\()\s*v\s*(\d{1,2})\s*\)?\s*$/i;
const norm = (v) => String(v || "").trim().replace(/\s+/g, " ").toLowerCase();

/** Numéro de version lu dans le nom (« …-v2 » → 2), sinon null. */
export function numVersion(nom) {
  const m = String(nom || "").match(SUFFIXE);
  return m ? Number(m[1]) : null;
}

/** Nom sans le suffixe de version (« …num 5-v2 » → « …num 5 »). */
export function nomBase(nom) {
  const s = String(nom || "").trim();
  return numVersion(s) === null ? s : s.replace(SUFFIXE, "").trim();
}

/** Clé du dossier (nom sans version + client + fiche) : la même pour toutes ses versions et tous ses passages. */
export const cleBase = (d) => [norm(nomBase(d?.nom_dossier)), norm(d?.client), norm(d?.nom_operation)].join("|");

const estModif = (d) => String(d?.nature_prod || "").toLowerCase().startsWith("modif");
const ordre = (d) => `${String(d.date || "").slice(0, 10)}|${String(d.created_at || "")}`;

/**
 * Unités « un dossier » : regroupe les lignes V1, V2… d'un même passage.
 * Renvoie Map(id ligne → { cle, membres, versions }) :
 *   · ligne sans suffixe : unité à elle seule, versions = nb_versions (1 par défaut) ;
 *   · lignes avec suffixe : la k-ième ligne de chaque version forme le k-ième passage du dossier.
 */
export function indexUnites(dossiers) {
  // Une nouvelle version saisie plus tard en « Modification » est une modif à part entière :
  // les versions ne sont réunies qu'entre lignes de même nature (nouveau / modif).
  const cleN = (d) => `${cleBase(d)}|${estModif(d) ? "m" : "n"}`;
  const avecSuffixe = new Set((dossiers || []).filter((d) => numVersion(d.nom_dossier) !== null).map(cleN));
  const parGroupe = new Map();
  for (const d of dossiers || []) {
    // Ligne sans suffixe d'une famille qui a des versions : c'est la V1
    if (numVersion(d.nom_dossier) === null && !avecSuffixe.has(cleN(d))) continue;
    const k = cleN(d);
    if (!parGroupe.has(k)) parGroupe.set(k, new Map());
    const v = numVersion(d.nom_dossier) ?? 1;
    const g = parGroupe.get(k);
    if (!g.has(v)) g.set(v, []);
    g.get(v).push(d);
  }
  const res = new Map();
  for (const [k, parVersion] of parGroupe) {
    const unites = new Map();
    for (const lignes of parVersion.values()) {
      lignes.sort((a, b) => ordre(a).localeCompare(ordre(b)));
      lignes.forEach((d, rang) => {
        const cu = `${k}#${rang}`;
        if (!unites.has(cu)) unites.set(cu, []);
        unites.get(cu).push(d);
      });
    }
    for (const [cu, membres] of unites) {
      membres.sort((a, b) => (numVersion(a.nom_dossier) ?? 1) - (numVersion(b.nom_dossier) ?? 1));
      const versions = Math.max(membres.length, ...membres.map((m) => Number(m.nb_versions) || 1));
      for (const m of membres) res.set(m.id, { cle: cu, membres, versions });
    }
  }
  for (const d of dossiers || []) {
    if (!res.has(d.id)) res.set(d.id, { cle: d.id, membres: [d], versions: Math.max(1, Number(d.nb_versions) || 1) });
  }
  return res;
}

/** Nombre de versions d'une ligne (champ, ou lignes sœurs V1/V2 si l'index est fourni). */
export function versionsDe(d, index) {
  return index?.get(d.id)?.versions || Math.max(1, Number(d?.nb_versions) || 1);
}

/** Libellé « V1 + V2 » des versions présentes. */
export function libelleVersions(info) {
  if (!info || info.versions < 2) return "";
  const nums = info.membres.map((m) => numVersion(m.nom_dossier)).filter((n) => n !== null);
  const liste = nums.length >= 2 ? nums : Array.from({ length: info.versions }, (_, i) => i + 1);
  return `${info.versions} versions · ${liste.map((n) => `V${n}`).join(" + ")}`;
}

/** Lignes de la même famille (même nom sans version), toutes natures et tous clients confondus. */
export function famille(nom, dossiers) {
  const b = norm(nomBase(nom));
  if (!b) return [];
  return (dossiers || []).filter((d) => norm(nomBase(d.nom_dossier)) === b);
}

/** Numéro de la prochaine version d'une famille (une ligne sans suffixe compte comme V1). */
export function versionSuivante(fam) {
  const nums = (fam || []).map((d) => numVersion(d.nom_dossier) ?? Math.max(1, Number(d.nb_versions) || 1));
  return (nums.length ? Math.max(...nums) : 0) + 1;
}

/** Nom d'une version : « …num 5 » + 3 → « …num 5-v3 ». */
export const nomVersion = (base, n) => `${String(base || "").trim()}-v${n}`;
