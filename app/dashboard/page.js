"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import KPICard from "@/components/KPICard";
import AlertesQualite from "@/components/AlertesQualite";
import TopCausesChart from "@/components/TopCausesChart";
import ChargeDetaillee from "@/components/ChargeDetaillee";
import ChargeParIngenieurTable from "@/components/ChargeParIngenieurTable";
import HorlogeDigitale from "@/components/HorlogeDigitale";
import SelectionPersonne from "@/components/SelectionPersonne";
import GraphiquesPopup from "@/components/GraphiquesPopup";
import ConformitePremierCoup from "@/components/ConformitePremierCoup";
import TendanceDelai from "@/components/TendanceDelai";
import HeatmapHebdo from "@/components/HeatmapHebdo";
import Leaderboard from "@/components/Leaderboard";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import {
  topCausesRetour,
  delaiMoyenVerification,
  dossiersRecurrents,
  tauxConformitePremierCoup,
  delaiParSemaine,
  repartitionParJourSemaine,
  grouperParIngenieur,
  calculerStatsIngenieur,
} from "@/lib/scoring";

export default function DashboardPage() {
  const { profile, erreurProfil, options, loading, supabase } = useAppData();
  const { nom: nomSelectionne, pret: pretPersonne, selectionner, changerDePersonne, validateurs } =
    useValidateurActif(profile, supabase);
  const estAdmin = profile?.role === "admin";
  const nomActif = estAdmin ? profile?.nom_complet : nomSelectionne;
  const [dossiers, setDossiers] = useState([]);
  const [objectifs, setObjectifs] = useState({});
  const [filtres, setFiltres] = useState(FILTRES_INITIAUX);
  const [graphiquesOuverts, setGraphiquesOuverts] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: doss }, { data: objs }] = await Promise.all([
        supabase.from("dossiers").select("*").order("date", { ascending: false }).limit(2000),
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

  const parIngenieur = grouperParIngenieur(filtres_);
  const classement = Object.entries(parIngenieur).map(([ingenieur, dossiersIng]) => ({
    ingenieur,
    stats: calculerStatsIngenieur(dossiersIng, objectifs[ingenieur]),
  }));

  return (
    <div>
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-start mb-1">
          <h1 className="font-display text-2xl font-bold">Dashboard</h1>
          <HorlogeDigitale />
        </div>
        <div className="flex justify-between items-center mb-6">
          <p className="text-ink/50">Vue d'ensemble de la production qualité.</p>
          <button onClick={() => setGraphiquesOuverts(true)} className="btn-secondary text-sm">
            📊 Voir les graphiques
          </button>
        </div>

        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-3 mb-6">
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
          <KPICard label={"Dossiers\nrécurrents"} value={recurrents.length} accent="red" />
        </div>

        <AlertesQualite dossiers={filtres_} />

        <div className="grid md:grid-cols-3 gap-6 mt-6">
          <ConformitePremierCoup taux={tauxConformitePremierCoup(filtres_)} />
          <TendanceDelai data={delaiParSemaine(filtres_)} />
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

        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <Leaderboard classement={classement} />
          <TopCausesChart data={topCausesRetour(filtres_)} />
        </div>
      </main>

      {graphiquesOuverts && (
        <GraphiquesPopup dossiers={filtres_} onFermer={() => setGraphiquesOuverts(false)} />
      )}
    </div>
  );
}
