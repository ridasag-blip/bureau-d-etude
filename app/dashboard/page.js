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
import GraphiquePopup, { GRAPHIQUES } from "@/components/GraphiquePopup";
import HeatmapHebdo from "@/components/HeatmapHebdo";
import HorlogeDigitale from "@/components/HorlogeDigitale";
import NavigationOnglets from "@/components/NavigationOnglets";
import PageHeader from "@/components/ui/PageHeader";
import Icon from "@/components/ui/Icon";
import { gardePage } from "@/components/ui/Screens";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import { delaiMoyenVerification, repartitionParJourSemaine } from "@/lib/scoring";
import { formatDuree } from "@/lib/constants";

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

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner });
  if (ecran) return ecran;

  const filtres_ = appliquerFiltres(dossiers, filtres);
  const parEtat = (etat) => filtres_.filter((d) => d.etat === etat).length;
  const delaiVerif = delaiMoyenVerification(filtres_);

  const enCoursIngenieurs = filtres_.filter((d) => d.etat === "Encours");
  const enAttenteAcceptation = filtres_.filter((d) => d.etat === "En attente de traitement");
  const enCoursQualite = filtres_.filter((d) => d.etat === "En cours de vérification");

  return (
    <div className="min-h-screen">
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <PageHeader
          icone="dashboard"
          titre="Tableau de bord"
          sousTitre={
            <>
              Bonjour <span className="capitalize font-medium text-ink/80">{nomActif}</span> — vue d'ensemble de la production.
            </>
          }
          actions={
            <>
              <div className="hidden md:block mr-3 pr-4 border-r border-line">
                <HorlogeDigitale sansLabel />
              </div>
              <button onClick={() => setGraphiqueOuvert("evolution")} className="btn-secondary">
                <Icon name="chart" size={16} />
                Graphiques
              </button>
              <button onClick={() => router.push("/saisie")} className="btn-primary">
                <Icon name="plus" size={16} />
                Nouveau dossier
              </button>
            </>
          }
        />

        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />

        <NavigationOnglets
          operations={options.operations}
          operationActive={filtres.operation}
          onChange={(op) => setFiltres((f) => ({ ...f, operation: op }))}
        />

        {/* Indicateurs, dans l'ordre du cycle de vie d'un dossier */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPICard label="Total dossiers" value={filtres_.length} accent="brand" icone="folder" />
          <KPICard label="En attente d'acceptation" value={parEtat("En attente de traitement")} accent="neutral" icone="inbox" />
          <KPICard label="En cours (ingénieurs)" value={parEtat("Encours")} accent="brand" icone="users" />
          <KPICard label="À vérifier" value={parEtat("En attente de vérification")} accent="gold" icone="clock" />
          <KPICard label="En cours de vérification" value={parEtat("En cours de vérification")} accent="brand" icone="shield" />
          <KPICard label="Audités" value={parEtat("Audité")} accent="green" icone="checkCircle" />
          <KPICard label="Suspendus" value={parEtat("Suspendue")} accent="red" icone="alert" />
          <KPICard
            label="Délai moyen 1ʳᵉ vérification"
            value={delaiVerif !== null ? formatDuree(delaiVerif) : "—"}
            accent="gold"
            icone="target"
          />
        </section>

        <div className="mb-6">
          <AlertesQualite dossiers={filtres_} />
        </div>

        <div className="mb-6">
          <ChargeParIngenieurTable ingenieurs={options.ingenieurs} dossiersEnCours={enCoursIngenieurs} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-6">
          <HeatmapHebdo data={repartitionParJourSemaine(filtres_)} />
          <ChargeDetaillee
            titre="En attente d'acceptation"
            dossiers={enAttenteAcceptation}
            champPersonne="ingenieur"
            badgeTexte="non acceptés"
            icone="inbox"
          />
          <ChargeDetaillee
            titre="Charge Qualité (en vérification)"
            dossiers={enCoursQualite}
            champPersonne="pris_en_charge_par"
            badgeTexte="en vérif."
            icone="shield"
          />
        </div>

        {/* Accès rapide aux graphiques */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {GRAPHIQUES.map((g) => (
            <button
              key={g.type}
              onClick={() => setGraphiqueOuvert(g.type)}
              className="card p-4 flex items-center gap-3 text-left hover:border-brand-300 hover:shadow-md transition"
            >
              <span className="w-9 h-9 rounded-lg bg-brand-50 text-brand-500 flex items-center justify-center shrink-0">
                <Icon name={g.icone} size={17} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{g.label}</span>
                <span className="block text-xs text-ink/45 truncate">{g.sousTitre}</span>
              </span>
            </button>
          ))}
        </section>
      </main>

      {graphiqueOuvert && (
        <GraphiquePopup type={graphiqueOuvert} dossiers={filtres_} onFermer={() => setGraphiqueOuvert(null)} />
      )}
    </div>
  );
}
