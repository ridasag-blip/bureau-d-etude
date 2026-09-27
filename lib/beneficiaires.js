import { normaliserAdresse, normaliserTelephone } from "@/lib/constants";

/**
 * Regroupe les dossiers par bénéficiaire.
 *  - même SIRET, même téléphone ou même e-mail → même bénéficiaire (automatique)
 *  - beneficiaire_groupe identique → fusion manuelle faite par l'admin
 *  - beneficiaire_isole = true → le dossier ne se regroupe que par son groupe manuel
 *    (sert à « séparer » deux bénéficiaires qui partagent un téléphone)
 * Renvoie une liste de bénéficiaires { cle, nom, siret, adresse, email, telephone, dossiers[] }.
 */
export function grouperBeneficiaires(dossiers) {
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  const avecBenef = dossiers.filter(
    (d) => d.beneficiaire_nom || d.beneficiaire_adresse || d.beneficiaire_telephone || d.beneficiaire_email || d.beneficiaire_siret
  );
  for (const d of avecBenef) parent.set("d:" + d.id, "d:" + d.id);

  const relier = (cle, d) => {
    if (!cle) return;
    if (!parent.has(cle)) parent.set(cle, cle);
    union("d:" + d.id, cle);
  };

  for (const d of avecBenef) {
    if (d.beneficiaire_groupe) relier("g:" + d.beneficiaire_groupe, d);
    if (d.beneficiaire_isole) continue;
    if (d.beneficiaire_siret) relier("s:" + d.beneficiaire_siret.replace(/\s/g, ""), d);
    const tel = normaliserTelephone(d.beneficiaire_telephone);
    if (tel.length >= 9) relier("t:" + tel, d);
    if (d.beneficiaire_email) relier("e:" + d.beneficiaire_email.trim().toLowerCase(), d);
  }

  const groupes = new Map();
  for (const d of avecBenef) {
    const r = find("d:" + d.id);
    if (!groupes.has(r)) groupes.set(r, []);
    groupes.get(r).push(d);
  }

  return [...groupes.entries()].map(([cle, liste]) => {
    const tries = [...liste].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    const premier = (champ) => tries.find((d) => d[champ])?.[champ] || "";
    return {
      cle,
      nom: premier("beneficiaire_nom"),
      siret: premier("beneficiaire_siret"),
      adresse: premier("beneficiaire_adresse"),
      email: premier("beneficiaire_email"),
      telephone: premier("beneficiaire_telephone"),
      dossiers: tries,
      fiches: [...new Set(tries.map((d) => d.nom_operation).filter(Boolean))],
      dernier: tries[0],
    };
  });
}

/** Paires de bénéficiaires distincts dont l'adresse normalisée est identique → doublons suggérés. */
export function doublonsSuggeres(beneficiaires) {
  const parAdresse = new Map();
  for (const b of beneficiaires) {
    const a = normaliserAdresse(b.adresse);
    if (a.length < 6) continue;
    if (!parAdresse.has(a)) parAdresse.set(a, []);
    parAdresse.get(a).push(b);
  }
  return [...parAdresse.values()].filter((l) => l.length > 1);
}

/** Dossier existant avec une adresse très proche sur la même fiche CEE (hors dossier courant). */
export function doublonAdresse(dossiers, adresse, operation, idCourant) {
  const cible = normaliserAdresse(adresse);
  if (cible.length < 6 || !operation) return null;
  return (
    dossiers.find(
      (d) =>
        d.id !== idCourant &&
        d.nom_operation === operation &&
        d.beneficiaire_adresse &&
        normaliserAdresse(d.beneficiaire_adresse) === cible
    ) || null
  );
}
