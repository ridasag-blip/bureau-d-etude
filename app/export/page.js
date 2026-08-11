"use client";
export const dynamic = "force-dynamic";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import DossierTable from "@/components/DossierTable";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";

export default function ExportPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [dossiers, setDossiers] = useState([]);
  const [filtres, setFiltres] = useState(FILTRES_INITIAUX);
  const [importResume, setImportResume] = useState(null);
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
      }))
    );
    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Export");
    XLSX.writeFile(classeur, `ISOBAT_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
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

  if (erreurProfil) {
    return (
      <div className="p-10 max-w-lg mx-auto text-center">
        <p className="text-isoRed font-medium mb-2">Profil introuvable</p>
        <p className="text-sm text-ink/60">{erreurProfil}</p>
      </div>
    );
  }
  if (loading || !profile) return <div className="p-10 text-center text-ink/40">Chargement…</div>;

  return (
    <div>
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold mb-1">Export</h1>
            <p className="text-ink/50">Extraction et import en masse.</p>
          </div>
          <div className="flex gap-3">
            <label className="btn-secondary cursor-pointer">
              Importer un Excel
              <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={importerFichier} className="hidden" />
            </label>
            <button onClick={exporterExcel} className="btn-primary">
              Exporter en Excel
            </button>
          </div>
        </div>

        {importResume && (
          <div
            className={`rounded-md px-3 py-2 text-sm mb-4 ${
              importResume.succes ? "bg-isoGreen/10 text-isoGreen-dark" : "bg-isoRed/10 text-isoRed"
            }`}
          >
            {importResume.message}
          </div>
        )}

        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />
        <DossierTable dossiers={filtres_} />
      </main>
    </div>
  );
}
