"use client";
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Modal from "@/components/ui/Modal";
import Icon from "@/components/ui/Icon";
import { S, emailValide, siretValide, telephoneValide, normaliserAdresse } from "@/lib/constants";

/**
 * Import en masse de dossiers depuis un fichier Excel (.xlsx / .xls) ou CSV.
 * Tous les dossiers importés vont dans la FILE D'ATTENTE (non attribués) :
 * ils sont ensuite distribués automatiquement aux ingénieurs (bouton « Terminé → suivant »)
 * ou attribués par la Qualité.
 * Aperçu obligatoire avant import : erreurs bloquantes et avertissements par ligne.
 */

const COLONNES = {
  nom_dossier: ["nom dossier", "dossier", "n dossier", "no dossier", "numero dossier", "reference", "ref"],
  date: ["date", "date dossier", "date de creation"],
  nom_operation: ["operation", "fiche", "fiche cee", "nom operation"],
  nature_prod: ["nature", "nature production", "nature prod"],
  client: ["client"],
  beneficiaire_nom: ["beneficiaire", "raison sociale", "nom beneficiaire", "nom ou raison sociale", "nom"],
  beneficiaire_siret: ["siret"],
  beneficiaire_adresse: ["adresse", "adresse beneficiaire"],
  beneficiaire_email: ["email", "e mail", "mail", "courriel"],
  beneficiaire_telephone: ["telephone", "tel", "portable", "mobile"],
  prioritaire: ["prioritaire", "priorite", "urgent"],
  commentaire: ["commentaire", "remarque", "note"],
};

const normEntete = (h) =>
  String(h || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const normTexte = (v) => normEntete(v);

function versDateIso(v) {
  if (!v) return new Date().toISOString().slice(0, 10);
  if (v instanceof Date && !isNaN(v)) {
    const d = new Date(v.getTime() - v.getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); // JJ/MM/AAAA
  if (m) {
    const annee = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${annee}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Retrouve la valeur officielle d'une liste (insensible à la casse et aux accents). */
function dansListe(valeur, liste) {
  if (!valeur) return "";
  const n = normTexte(valeur);
  return liste.find((x) => normTexte(x) === n) || null;
}

export function telechargerModele(options) {
  const exemple = {
    "Nom dossier": "DUPONT 2026-001",
    Date: new Date().toLocaleDateString("fr-FR"),
    Opération: options.operations?.[0] || "BAR-TH-171",
    Nature: options.naturesProd?.[0] || "Nouveau dossier",
    Client: options.clients?.[0] || "",
    "Nom ou raison sociale": "M. Jean Dupont",
    SIRET: "",
    Adresse: "12 avenue de la Gare, 69003 Lyon",
    "E-mail": "jean.dupont@mail.fr",
    Téléphone: "06 12 34 56 78",
    Prioritaire: "non",
    Commentaire: "",
  };
  const feuille = XLSX.utils.json_to_sheet([exemple]);
  feuille["!cols"] = Object.keys(exemple).map((k) => ({ wch: Math.max(14, k.length + 4) }));
  const aide = XLSX.utils.aoa_to_sheet([
    ["Colonne", "Obligatoire", "Règle"],
    ["Nom dossier", "Oui", "Identifiant du dossier"],
    ["Date", "Non", "JJ/MM/AAAA — aujourd'hui si vide"],
    ["Opération", "Oui", `Une de : ${(options.operations || []).join(", ")}`],
    ["Nature", "Non", `Une de : ${(options.naturesProd || []).join(", ")} — « Nouveau dossier » si vide`],
    ["Client", "Non", `Une de : ${(options.clients || []).join(", ")}`],
    ["Nom ou raison sociale", "Oui", "Bénéficiaire des travaux"],
    ["SIRET", "Non", "14 chiffres, personne morale uniquement"],
    ["Adresse", "Oui", "Adresse complète en une seule cellule"],
    ["E-mail / Téléphone", "Non", "Téléphone français à 10 chiffres"],
    ["Prioritaire", "Non", "oui / non"],
  ]);
  aide["!cols"] = [{ wch: 22 }, { wch: 12 }, { wch: 80 }];
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "Dossiers");
  XLSX.utils.book_append_sheet(classeur, aide, "Aide");
  XLSX.writeFile(classeur, "HILLSOLUTION_modele_import_dossiers.xlsx");
}

export default function ImportDossiers({ options, supabase, nomTrace, onFermer, onTermine }) {
  const [lignes, setLignes] = useState(null);
  const [fichier, setFichier] = useState("");
  const [colonnesTrouvees, setColonnesTrouvees] = useState([]);
  const [envoi, setEnvoi] = useState(false);
  const [resultat, setResultat] = useState(null);
  const [filtre, setFiltre] = useState("tout"); // tout | erreurs
  const ref = useRef(null);

  async function lire(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFichier(f.name);
    setResultat(null);
    const classeur = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    const brut = XLSX.utils.sheet_to_json(classeur.Sheets[classeur.SheetNames[0]], { defval: "" });

    // Correspondance entêtes du fichier → champs de l'app
    const entetes = Object.keys(brut[0] || {});
    const correspondance = {};
    for (const [champ, alias] of Object.entries(COLONNES)) {
      const trouve = entetes.find((h) => alias.includes(normEntete(h)));
      if (trouve) correspondance[champ] = trouve;
    }
    setColonnesTrouvees(Object.keys(correspondance));

    // Contrôle des doublons contre la base (nom de dossier + adresse sur la même fiche)
    const { data: existants } = await supabase
      .from("dossiers")
      .select("nom_dossier, nom_operation, beneficiaire_adresse")
      .limit(20000);
    const nomsExistants = new Set((existants || []).map((d) => normTexte(d.nom_dossier)));
    const adressesExistantes = new Set(
      (existants || []).filter((d) => d.beneficiaire_adresse).map((d) => `${d.nom_operation}|${normaliserAdresse(d.beneficiaire_adresse)}`)
    );
    const vusFichier = new Set();

    const resultatLignes = brut
      .map((r, i) => {
        const v = (champ) => (correspondance[champ] ? r[correspondance[champ]] : "");
        const txt = (champ) => String(v(champ) ?? "").trim();
        const erreurs = [];
        const avert = [];

        const nom_dossier = txt("nom_dossier");
        if (!nom_dossier) erreurs.push("Nom dossier manquant");

        const operation = dansListe(txt("nom_operation"), options.operations);
        if (!txt("nom_operation")) erreurs.push("Opération manquante");
        else if (!operation) erreurs.push(`Opération inconnue « ${txt("nom_operation")} »`);

        let nature = dansListe(txt("nature_prod"), options.naturesProd);
        if (!txt("nature_prod")) nature = options.naturesProd.includes("Nouveau dossier") ? "Nouveau dossier" : options.naturesProd[0];
        else if (!nature) erreurs.push(`Nature inconnue « ${txt("nature_prod")} »`);

        let client = null;
        if (txt("client")) {
          client = dansListe(txt("client"), options.clients);
          if (!client) erreurs.push(`Client inconnu « ${txt("client")} » (à ajouter dans Paramètres)`);
        }

        if (operation && !Object.values(options.habilitations || {}).some((ops) => ops.includes(operation)))
          avert.push("Aucun ingénieur habilité sur cette fiche");

        const date = versDateIso(v("date"));
        if (!date) erreurs.push(`Date illisible « ${txt("date")} »`);

        const benefNom = txt("beneficiaire_nom");
        const adresse = txt("beneficiaire_adresse");
        if (!benefNom) erreurs.push("Bénéficiaire manquant");
        if (!adresse) erreurs.push("Adresse manquante");

        const siret = txt("beneficiaire_siret").replace(/\s/g, "");
        if (siret && !siretValide(siret)) erreurs.push("SIRET invalide");
        const email = txt("beneficiaire_email");
        if (email && !emailValide(email)) erreurs.push("E-mail invalide");
        const tel = txt("beneficiaire_telephone");
        if (tel && !telephoneValide(tel)) avert.push("Téléphone non standard");

        const cleNom = normTexte(nom_dossier);
        if (nom_dossier && nomsExistants.has(cleNom)) avert.push("Nom déjà existant en base");
        if (nom_dossier && vusFichier.has(cleNom)) avert.push("En double dans le fichier");
        vusFichier.add(cleNom);
        if (operation && adresse && adressesExistantes.has(`${operation}|${normaliserAdresse(adresse)}`))
          avert.push(`Adresse déjà existante sur ${operation}`);

        const prio = ["oui", "o", "x", "1", "true", "vrai", "yes"].includes(normTexte(v("prioritaire")));

        return {
          ligne: i + 2, // n° de ligne Excel (entête = 1)
          erreurs,
          avert,
          payload: {
            nom_dossier,
            date,
            nom_operation: operation,
            nature_prod: nature,
            client,
            beneficiaire_nom: benefNom || null,
            beneficiaire_siret: siret || null,
            beneficiaire_adresse: adresse || null,
            beneficiaire_email: email || null,
            beneficiaire_telephone: tel || null,
            prioritaire: prio,
            commentaire: txt("commentaire") || null,
          },
        };
      })
      .filter((l) => {
        // ignore les lignes vides
        const p = l.payload;
        return p.nom_dossier || p.beneficiaire_nom || p.beneficiaire_adresse || p.nom_operation;
      });
    setLignes(resultatLignes);
    if (ref.current) ref.current.value = "";
  }

  const valides = useMemo(() => (lignes || []).filter((l) => l.erreurs.length === 0), [lignes]);
  const enErreur = (lignes || []).length - valides.length;

  async function importer() {
    setEnvoi(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const maintenant = new Date().toISOString();
    const lignesDb = valides.map(({ payload: p }) => ({
      ...p,
      ingenieur: null,
      etat: S.FILE,
      date_mise_en_file: maintenant,
      created_by: user?.id,
    }));

    let crees = [];
    const erreursEnvoi = [];
    for (let i = 0; i < lignesDb.length; i += 200) {
      const lot = lignesDb.slice(i, i + 200);
      const { data, error } = await supabase.from("dossiers").insert(lot).select("id");
      if (error) erreursEnvoi.push(error.message);
      else crees = crees.concat(data || []);
    }
    if (crees.length) {
      await supabase.from("dossier_evenements").insert(
        crees.map((d) => ({
          dossier_id: d.id,
          type: "mise_en_file",
          cause: "Import fichier",
          effectue_par_nom: nomTrace,
        }))
      );
    }
    setEnvoi(false);
    setResultat({ crees: crees.length, erreurs: erreursEnvoi });
    if (crees.length) onTermine?.();
  }

  const affichees = (lignes || []).filter((l) => filtre === "tout" || l.erreurs.length || l.avert.length);

  return (
    <Modal titre="Alimenter la file d'attente" sousTitre="Import d'un fichier Excel (.xlsx, .xls) ou CSV" onFermer={onFermer} taille="xl">
      {!lignes && (
        <div className="flex flex-col gap-5">
          <div className="alert alert-info">
            <Icon name="inbox" size={16} className="mt-0.5" />
            <span>
              Les dossiers importés vont dans la <strong>file d'attente</strong>. Ils sont ensuite distribués automatiquement
              aux ingénieurs, ou attribués par la Qualité.
            </span>
          </div>

          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/40 px-6 py-10 cursor-pointer hover:bg-brand-50 transition-colors text-center">
            <Icon name="upload" size={26} className="text-brand-500" />
            <span className="font-semibold">Choisir un fichier</span>
            <span className="text-xs text-ink/50">Un aperçu s'affiche avant tout enregistrement</span>
            <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={lire} />
          </label>

          <button className="btn-ghost btn-sm self-center" onClick={() => telechargerModele(options)}>
            <Icon name="download" size={14} />
            Télécharger le modèle Excel
          </button>
        </div>
      )}

      {lignes && !resultat && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold truncate max-w-[260px]">{fichier}</span>
            <span className="badge badge-neutral">{lignes.length} ligne(s)</span>
            <span className="badge badge-green">{valides.length} prête(s)</span>
            {enErreur > 0 && <span className="badge badge-red">{enErreur} en erreur (ignorée(s))</span>}
            <button className="btn-ghost btn-xs ml-auto" onClick={() => setLignes(null)}>
              Changer de fichier
            </button>
          </div>

          {colonnesTrouvees.length < 4 && (
            <div className="alert alert-gold">
              <Icon name="alert" size={16} className="mt-0.5" />
              <span>
                Peu de colonnes reconnues ({colonnesTrouvees.length}). Vérifie les entêtes, ou pars du modèle Excel.
              </span>
            </div>
          )}


          <div className="segmented w-fit">
            <button data-active={filtre === "tout"} onClick={() => setFiltre("tout")}>
              Toutes les lignes
            </button>
            <button data-active={filtre === "erreurs"} onClick={() => setFiltre("erreurs")}>
              Erreurs et avertissements
            </button>
          </div>

          <div className="card overflow-auto max-h-[45vh]">
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Dossier</th>
                  <th>Fiche</th>
                  <th>Bénéficiaire</th>
                  <th>Priorité</th>
                  <th>Contrôle</th>
                </tr>
              </thead>
              <tbody>
                {affichees.map((l) => (
                  <tr key={l.ligne} className={l.erreurs.length ? "bg-isoRed-light/40" : ""}>
                    <td className="tabular text-ink/50">{l.ligne}</td>
                    <td className="font-semibold">{l.payload.nom_dossier || "—"}</td>
                    <td>{l.payload.nom_operation || "—"}</td>
                    <td>
                      {l.payload.beneficiaire_nom || "—"}
                      <span className="block text-ink/45 truncate max-w-[200px]">{l.payload.beneficiaire_adresse}</span>
                    </td>
                    <td className="whitespace-nowrap">
                      {l.payload.prioritaire ? (
                        <span className="badge badge-red">
                          <Icon name="flame" size={11} />
                          Prioritaire
                        </span>
                      ) : (
                        <span className="text-ink/30">—</span>
                      )}
                    </td>
                    <td>
                      {l.erreurs.map((e) => (
                        <span key={e} className="block text-isoRed-dark font-medium">
                          ✕ {e}
                        </span>
                      ))}
                      {l.avert.map((e) => (
                        <span key={e} className="block text-isoGold-dark">
                          ! {e}
                        </span>
                      ))}
                      {!l.erreurs.length && !l.avert.length && <span className="text-isoGreen-dark">✓ OK</span>}
                    </td>
                  </tr>
                ))}
                {affichees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="table-empty">
                      Aucune ligne à afficher.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2 border-t border-line -mx-6 px-6 pt-4">
            <button className="btn-secondary" onClick={onFermer}>
              Annuler
            </button>
            <button className="btn-primary" disabled={!valides.length || envoi} onClick={importer}>
              <Icon name="upload" size={15} />
              {envoi ? "Import en cours…" : `Ajouter ${valides.length} dossier(s) à la file`}
            </button>
          </div>
        </div>
      )}

      {resultat && (
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <span
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              resultat.erreurs.length ? "bg-isoGold-light text-isoGold-dark" : "bg-isoGreen-light text-isoGreen-dark"
            }`}
          >
            <Icon name={resultat.erreurs.length ? "alert" : "checkCircle"} size={26} />
          </span>
          <p className="font-display text-xl font-bold">{resultat.crees} dossier(s) ajouté(s) à la file</p>
          {resultat.erreurs.map((e) => (
            <p key={e} className="text-sm text-isoRed">
              {e}
            </p>
          ))}
          <button className="btn-primary mt-2" onClick={onFermer}>
            Fermer
          </button>
        </div>
      )}
    </Modal>
  );
}

/** Export de la file d'attente, au même format que l'import (réimportable). */
export function exporterFile(dossiers) {
  const lignes = dossiers.map((d) => ({
    "Nom dossier": d.nom_dossier,
    Date: d.date ? new Date(d.date).toLocaleDateString("fr-FR") : "",
    Opération: d.nom_operation,
    Nature: d.nature_prod || "",
    Client: d.client || "",
    "Nom ou raison sociale": d.beneficiaire_nom || "",
    SIRET: d.beneficiaire_siret || "",
    Adresse: d.beneficiaire_adresse || "",
    "E-mail": d.beneficiaire_email || "",
    Téléphone: d.beneficiaire_telephone || "",
    Prioritaire: d.prioritaire ? "oui" : "non",
    Commentaire: d.commentaire || "",
    "Dans la file depuis": d.date_mise_en_file ? new Date(d.date_mise_en_file).toLocaleString("fr-FR") : "",
  }));
  const feuille = XLSX.utils.json_to_sheet(lignes.length ? lignes : [{ "Nom dossier": "" }]);
  feuille["!cols"] = Object.keys(lignes[0] || { a: 1 }).map((k) => ({ wch: Math.max(14, k.length + 4) }));
  const classeur = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(classeur, feuille, "File d'attente");
  XLSX.writeFile(classeur, `HILLSOLUTION_file_attente_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
