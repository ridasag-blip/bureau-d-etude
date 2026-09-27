"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import KPICard from "@/components/KPICard";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import { gardePage } from "@/components/ui/Screens";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import { grouperParIngenieur, calculerStatsIngenieur, topCausesRetour } from "@/lib/scoring";

export default function RapportPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;
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

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner });
  if (ecran) return ecran;

  const filtres_ = appliquerFiltres(dossiers, filtres);
  const parIngenieur = grouperParIngenieur(filtres_);
  const lignes = Object.entries(parIngenieur).map(([ingenieur, dossiersIng]) => ({
    ingenieur,
    stats: calculerStatsIngenieur(dossiersIng, objectifs[ingenieur]),
  }));
  const causes = topCausesRetour(filtres_);

  function genererPDF() {
    const doc = new jsPDF();

    // Bandeau aux couleurs du logo (bleu) + filet vert
    doc.setFillColor(31, 111, 168);
    doc.rect(0, 0, 210, 24, "F");
    doc.setFillColor(78, 159, 61);
    doc.rect(0, 24, 210, 1.5, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(15);
    doc.setFont("helvetica", "bold");
    doc.text("Hill Solution", 14, 11);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Rapport Qualité — Bureau d'Études", 14, 18);

    doc.setTextColor(19, 33, 47);
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
      headStyles: { fillColor: [31, 111, 168] },
      alternateRowStyles: { fillColor: [244, 246, 249] },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    let y = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.text("Top causes de retour", 14, y);
    autoTable(doc, {
      startY: y + 4,
      head: [["Cause", "Nombre"]],
      body: causes.map((c) => [c.cause, c.total]),
      headStyles: { fillColor: [211, 58, 58] },
      alternateRowStyles: { fillColor: [244, 246, 249] },
      styles: { fontSize: 9, cellPadding: 2.5 },
    });

    doc.save(`HILLSOLUTION_rapport_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  const periode = `${filtres.mois !== "Tous" ? filtres.mois : "Toute période"} ${
    filtres.annee !== "Tous" ? filtres.annee : ""
  }`.trim();

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="file"
          titre="Rapport"
          sousTitre="Génère un résumé PDF prêt à envoyer à la direction."
          actions={
            <button onClick={genererPDF} className="btn-primary" disabled={filtres_.length === 0}>
              <Icon name="download" size={16} />
              Générer le PDF
            </button>
          }
        />
        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />

        <div className="card p-5">
          <p className="eyebrow mb-1">Aperçu du rapport</p>
          <p className="font-display font-bold text-lg mb-4">{periode}</p>
          <div className="grid grid-cols-3 gap-3">
            <KPICard label="Dossiers" value={filtres_.length} accent="brand" icone="folder" />
            <KPICard label="Ingénieurs concernés" value={lignes.length} accent="green" icone="users" />
            <KPICard label="Causes de retour" value={causes.length} accent="red" icone="alert" />
          </div>
          <p className="text-xs text-ink/45 mt-4 flex items-center gap-1.5">
            <Icon name="file" size={13} />
            Contenu : tableau des scores par ingénieur + top causes de retour, aux couleurs Hill Solution.
          </p>
        </div>
      </main>
    </div>
  );
}
