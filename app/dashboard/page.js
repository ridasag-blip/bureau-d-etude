"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import KPICard from "@/components/KPICard";
import AlertesQualite from "@/components/AlertesQualite";
import ChargeDetaillee from "@/components/ChargeDetaillee";
import ChargeParIngenieurTable from "@/components/ChargeParIngenieurTable";
import HorlogeDigitale from "@/components/HorlogeDigitale";
import SelectionPersonne from "@/components/SelectionPersonne";
import GraphiquePopup from "@/components/GraphiquePopup";
import HeatmapHebdo from "@/components/HeatmapHebdo";
import NavigationOnglets from "@/components/NavigationOnglets";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import { delaiMoyenVerification, dossiersRecurrents, repartitionParJourSemaine } from "@/lib/scoring";

const BOUTONS_GRAPHIQUES = [
  { type: "evolution", label: "📈 Évolution mensuelle" },
  { type: "operation", label: "📊 Répartition opération" },
  { type: "client", label: "🏢 Vue clients" },
  { type: "nature", label: "🔄 Nouveaux vs Modifications" },
];

export default function DashboardPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;

  const router = useRouter();

  const [dossiers, setDossiers] = useState([]);
  const [filtres, setFiltres] = useState(FILTRES_INITIAUX);
  const [graphiqueOuvert, setGraphiqueOuvert] = useState(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from("dossiers").select("*").order("date", { ascending: false }).limit(2000);
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
  if (!estAdmin && !pretPersonne) return <div className="p-10 text-center text-ink/40">Chargement…</div>;

  if (!estAdmin && !nomActif) {
    return <SelectionPersonne personnes={validateurs} onSelection={selectionner} />;
  }

  const filtres_ = appliquerFiltres(dossiers, filtres);
  const parEtat = (etat) => filtres_.filter((d) => d.etat === etat).length;
  const delaiVerif = delaiMoyenVerification(filtres_);
  const recurrents = dossiersRecurrents(filtres_);

  const enCoursIngenieurs = filtres_.filter((d) => d.etat === "Encours");
  const enAttenteAcceptation = filtres_.filter((d) => d.etat === "En attente de traitement");
  const enCoursQualite = filtres_.filter((d) => d.etat === "En cours de vérification");

  return (
    <div>
      <Navbar
        role={profile.role}
        nom={nomActif}
        onChangerPersonne={estAdmin ? undefined : changerDePersonne}
        masquerHorloge
      />
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* 1. Filtres, centrés, tout en haut */}
        <div className="flex justify-center">
          <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />
        </div>

        {/* 2. Bande logo (+ horloge dessous) + KPI */}
        <div className="card px-6 py-2 mb-6 flex flex-col md:flex-row gap-6">
          <div className="flex flex-col items-center justify-center gap-1 md:w-72 shrink-0 md:border-r border-black/5 md:pr-6">
            <img src="/logo-hillsolution.png" alt="Hill Solution" className="h-44 w-auto" />
            <HorlogeDigitale />
          </div>
          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard label={"Total\ndossiers"} value={filtres_.length} accent="navy" />
            <KPICard label={"En attente\nd'accept."} value={parEtat("En attente de traitement")} accent="gold" />
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
          </div>
        </div>

        {/* 3. Opération */}
        <NavigationOnglets
          operations={options.operations}
          operationActive={filtres.operation}
          onChange={(op) => setFiltres((f) => ({ ...f, operation: op }))}
        />

        {/* 4. Graphiques + Nouveau dossier, même ligne */}
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div className="flex flex-wrap gap-3">
            {BOUTONS_GRAPHIQUES.map((b) => (
              <button
                key={b.type}
                onClick={() => setGraphiqueOuvert(b.type)}
                className="btn-secondary text-sm"
              >
                {b.label}
              </button>
            ))}
          </div>
          <button onClick={() => router.push("/saisie")} className="btn-primary text-sm">
            Nouveau dossier
          </button>
        </div>

        <AlertesQualite dossiers={filtres_} />

        <div className="mt-6">
          <HeatmapHebdo data={repartitionParJourSemaine(filtres_)} />
        </div>

        <div className="mt-6">
          <ChargeParIngenieurTable ingenieurs={options.ingenieurs} dossiersEnCours={enCoursIngenieurs} />
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <ChargeDetaillee
            titre="En attente d'acceptation"
            dossiers={enAttenteAcceptation}
            champPersonne="ingenieur"
            badgeTexte="non acceptés"
          />
          <ChargeDetaillee
            titre="Charge actuelle Qualité (en cours de vérif.)"
            dossiers={enCoursQualite}
            champPersonne="pris_en_charge_par"
            badgeTexte="en vérif."
          />
        </div>
      </main>

      {graphiqueOuvert && (
        <GraphiquePopup type={graphiqueOuvert} dossiers={filtres_} onFermer={() => setGraphiqueOuvert(null)} />
      )}
    </div>
  );
}
