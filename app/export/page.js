"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import DossierTable from "@/components/DossierTable";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import { gardePage } from "@/components/ui/Screens";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";

export default function ExportPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;
  const [dossiers, setDossiers] = useState([]);
  const [filtres, setFiltres] = useState(FILTRES_INITIAUX);
  const [importResume, setImportResume] = useState(null);
  const [avecCoordonnees, setAvecCoordonnees] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from("dossiers").select("*").limit(5000);
      setDossiers(data || []);
    })();
  }, [profile]);

  const filtres_ = appliquerFiltres(dossiers, filtres);

  function exporterExcel() {
    const feuille = XLSX.utils.json_to_sheet(
      filtres_.map((d) => ({
        Date: d.date,
        "Nom dossier": d.nom_dossier,
        Ingénieur: d.ingenieur,
        Opération: d.nom_operation,
        Client: d.client,
        État: d.etat,
        "Nature production": d.nature_prod,
        "Retour interne": d.retour_interne ? "Oui" : "Non",
        "Cause retour interne": d.cause_retour_interne,
        "Retour client": d.retour_client ? "Oui" : "Non",
        "Cause retour client": d.cause_retour_client,
        "Validé par": d.valide_par,
        Commentaire: d.commentaire,
        Bénéficiaire: d.beneficiaire_nom,
        ...(avecCoordonnees
          ? {
              SIRET: d.beneficiaire_siret,
              Adresse: d.beneficiaire_adresse,
              "E-mail": d.beneficiaire_email,
              Téléphone: d.beneficiaire_telephone,
            }
          : {}),
      }))
    );
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Export");
    XLSX.writeFile(classeur, `HILLSOLUTION_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function importerFichier(e) {
    const fichier = e.target.files[0];
    if (!fichier) return;
    const buffer = await fichier.arrayBuffer();
    const classeur = XLSX.read(buffer);
    const feuille = classeur.Sheets[classeur.SheetNames[0]];
    const lignes = XLSX.utils.sheet_to_json(feuille);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = lignes.map((l) => ({
      date: l["Date"] || new Date().toISOString().slice(0, 10),
      nom_dossier: l["Nom dossier"],
      ingenieur: l["Ingénieur"],
      nom_operation: l["Opération"],
      client: l["Client"] || null,
      etat: l["État"],
      nature_prod: l["Nature production"],
      retour_interne: l["Retour interne"] === "Oui",
      cause_retour_interne: l["Cause retour interne"] || null,
      retour_client: l["Retour client"] === "Oui",
      cause_retour_client: l["Cause retour client"] || null,
      valide_par: l["Validé par"] || null,
      commentaire: l["Commentaire"] || null,
      beneficiaire_nom: l["Bénéficiaire"] || null,
      beneficiaire_siret: l["SIRET"] ? String(l["SIRET"]).replace(/\s/g, "") : null,
      beneficiaire_adresse: l["Adresse"] || null,
      beneficiaire_email: l["E-mail"] || null,
      beneficiaire_telephone: l["Téléphone"] ? String(l["Téléphone"]) : null,
      created_by: user.id,
    }));

    const { error, data } = await supabase.from("dossiers").insert(payload).select();
    setImportResume(
      error
        ? { succes: false, message: error.message }
        : { succes: true, message: `${data.length} dossier(s) importé(s) avec succès.` }
    );
    fileRef.current.value = "";
  }

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner });
  if (ecran) return ecran;

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="download"
          titre="Export"
          sousTitre="Extraction Excel filtrée et import en masse."
          actions={
            <>
              <label className="btn-secondary cursor-pointer">
                <Icon name="upload" size={16} />
                Importer un Excel
                <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importerFichier} className="hidden" />
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer mr-2">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-[#1F6FA8]"
                  checked={avecCoordonnees}
                  onChange={(e) => setAvecCoordonnees(e.target.checked)}
                />
                Inclure les coordonnées
              </label>
              <button onClick={exporterExcel} className="btn-primary" disabled={filtres_.length === 0}>
                <Icon name="download" size={16} />
                Exporter {filtres_.length} dossier{filtres_.length > 1 ? "s" : ""}
              </button>
            </>
          }
        />

        {importResume && (
          <div className={`alert mb-6 ${importResume.succes ? "alert-green" : "alert-red"}`} role="status">
            <Icon name={importResume.succes ? "checkCircle" : "alert"} size={16} className="mt-0.5" />
            <span className="flex-1">{importResume.message}</span>
            <button onClick={() => setImportResume(null)} className="opacity-60 hover:opacity-100" aria-label="Fermer">
              <Icon name="x" size={14} />
            </button>
          </div>
        )}

        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />
        <DossierTable dossiers={filtres_} />
      </main>
    </div>
  );
}
