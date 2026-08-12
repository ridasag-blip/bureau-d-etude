"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import KPICard from "@/components/KPICard";
import AlertesQualite from "@/components/AlertesQualite";
import TopCausesChart from "@/components/TopCausesChart";
import ChargeDetaillee from "@/components/ChargeDetaillee";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { topCausesRetour, delaiMoyenVerification, dossiersRecurrents } from "@/lib/scoring";

export default function DashboardPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const [dossiers, setDossiers] = useState([]);
  const [filtres, setFiltres] = useState(FILTRES_INITIAUX);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from("dossiers")
        .select("*")
        .order("date", { ascending: false })
        .limit(2000);
      setDossiers(data || []);
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
  const parEtat = (etat) => filtres_.filter((d) => d.etat === etat).length;
  const delaiVerif = delaiMoyenVerification(filtres_);
  const recurrents = dossiersRecurrents(filtres_);

  const enCoursIngenieurs = filtres_.filter((d) => d.etat === "Encours");
  const enCoursQualite = filtres_.filter((d) => d.etat === "En cours de vérification");

  return (
    <div>
      <Navbar role={profile.role} nom={profile.nom_complet} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-ink/50 mb-6">Vue d'ensemble de la production qualité.</p>

        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <KPICard label={"Total\ndossiers"} value={filtres_.length} accent="navy" />
          <KPICard label={"En cours\n(ingé.)"} value={parEtat("Encours")} accent="navy" />
          <KPICard label={"À\nvérifier"} value={parEtat("En attente de vérification")} accent="gold" />
          <KPICard label={"En cours\nde vérif."} value={parEtat("En cours de vérification")} accent="gold" />
          <KPICard label={"Audité"} value={parEtat("Audité")} accent="green" />
          <KPICard label={"Suspendue"} value={parEtat("Suspendue")} accent="red" />
          <KPICard
            label={"Délai moy.\n1ère vérif."}
            value={delaiVerif !== null ? `${delaiVerif.toFixed(1)}h` : "—"}
            accent="gold"
          />
          <KPICard label={"Dossiers\nrécurrents"} value={recurrents.length} accent="red" />
        </div>

        <AlertesQualite dossiers={filtres_} />

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <ChargeDetaillee
            titre="Charge actuelle par ingénieur"
            dossiers={enCoursIngenieurs}
            champPersonne="ingenieur"
            badgeTexte="en cours"
          />
          <ChargeDetaillee
            titre="Charge actuelle Qualité (en cours de vérif.)"
            dossiers={enCoursQualite}
            champPersonne="pris_en_charge_par"
            badgeTexte="en vérif."
          />
        </div>

        <div className="mt-6">
          <TopCausesChart data={topCausesRetour(filtres_)} />
        </div>
      </main>
    </div>
  );
}
