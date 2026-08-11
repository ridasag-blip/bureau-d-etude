"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { grouperParIngenieur, calculerStatsIngenieur, topCausesRetour } from "@/lib/scoring";

export default function RapportPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [dossiers, setDossiers] = useState([]);
  const [objectifs, setObjectifs] = useState({});
  const [filtres, setFiltres] = useState(FILTRES_INITIAUX);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: doss }, { data: objs }] = await Promise.all([
        supabase.from("dossiers").select("*").limit(5000),
        supabase.from("objectifs").select("*"),
      ]);
      setDossiers(doss || []);
      const map = {};
      (objs || []).forEach((o) => (map[o.ingenieur] = o));
      setObjectifs(map);
    })();
  }, [profile]);

  if (erreurProfil) {
    return (
      <div className="p-10 max-w-lg mx-auto text-center">
        <p className="text-isoRed font-medium mb-2">Profil introuvable</p>
        <p className="text-sm text-ink/60">{erreurProfil}</p>
      </div>
    );
  }
  if (loading || !profile) return <div className="p-10 text-center text-ink/40">Chargement…</div>;

  const filtres_ = appliquerFiltres(dossiers, filtres);
  const parIngenieur = grouperParIngenieur(filtres_);
  const lignes = Object.entries(parIngenieur).map(([ingenieur, dossiersIng]) => ({
    ingenieur,
    stats: calculerStatsIngenieur(dossiersIng, objectifs[ingenieur]),
  }));
  const causes = topCausesRetour(filtres_);

  function genererPDF() {
    const doc = new jsPDF();

    doc.setFillColor(14, 138, 62);
    doc.rect(0, 0, 210, 22, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.text("ISO BAT — Rapport Qualité Bureau d'Étude", 14, 14);

    doc.setTextColor(20, 20, 20);
    doc.setFontSize(10);
    const periode = `${filtres.mois !== "Tous" ? filtres.mois : "Toute période"} ${
      filtres.annee !== "Tous" ? filtres.annee : ""
    }`.trim();
    doc.text(`Période : ${periode}`, 14, 30);
    doc.text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, 14, 36);

    doc.setFontSize(12);
    doc.text(`Total dossiers traités : ${filtres_.length}`, 14, 46);

    autoTable(doc, {
      startY: 52,
      head: [["Ingénieur", "Traité", "Atteinte", "Retour int.", "Retour client", "Score Global"]],
      body: lignes.map(({ ingenieur, stats }) => [
        ingenieur,
        stats.dossierTraiteTotal,
        stats.statutAtteinte,
        stats.nbRetourInterne,
        stats.nbRetourClient,
        stats.scoreGlobal !== null ? stats.scoreGlobal.toFixed(0) : "—",
      ]),
      headStyles: { fillColor: [14, 138, 62] },
      styles: { fontSize: 9 },
    });

    let y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Top causes de retour", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Cause", "Nombre"]],
      body: causes.map((c) => [c.cause, c.total]),
      headStyles: { fillColor: [199, 7, 10] },
      styles: { fontSize: 9 },
    });

    doc.save(`ISOBAT_rapport_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  return (
    <div>
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl font-bold mb-1">Rapport</h1>
            <p className="text-ink/50">Génère un résumé PDF prêt à envoyer à la direction.</p>
          </div>
          <button onClick={genererPDF} className="btn-primary">
            Générer le PDF
          </button>
        </div>
        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />
        <div className="card p-4 text-sm text-ink/60">
          Aperçu : {filtres_.length} dossier(s), {lignes.length} ingénieur(s) concerné(s), top{" "}
          {causes.length} cause(s) de retour sur la période sélectionnée.
        </div>
      </main>
    </div>
  );
}
