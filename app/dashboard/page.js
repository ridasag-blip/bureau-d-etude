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
import { formatDuree, S } from "@/lib/constants";
import PointDuMatin from "@/components/PointDuMatin";

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
  const [retoursHier, setRetoursHier] = useState([]);
  const [config, setConfig] = useState(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const hier = new Date();
      hier.setDate(hier.getDate() - 1);
      hier.setHours(0, 0, 0, 0);
      const aujourdhui = new Date();
      aujourdhui.setHours(0, 0, 0, 0);
      const [{ data }, { data: ret }, { data: conf }] = await Promise.all([
        supabase.from("dossiers").select("*").order("date", { ascending: false }).limit(3000),
        supabase
          .from("dossier_retours")
          .select("cause, type, created_at")
          .gte("created_at", hier.toISOString())
          .lt("created_at", aujourdhui.toISOString()),
        supabase.from("parametres_config").select("*").limit(1).maybeSingle(),
      ]);
      setDossiers(data || []);
      setRetoursHier(ret || []);
      setConfig(conf || null);
    })();
  }, [profile]);

  const ecran = gardePage({ erreurProfil, loading, profile, estAdmin, pretPersonne, nomActif, validateurs, selectionner });
  if (ecran) return ecran;

  const filtres_ = appliquerFiltres(dossiers, filtres);
  const parEtat = (etat) => filtres_.filter((d) => d.etat === etat).length;
  const delaiVerif = delaiMoyenVerification(filtres_);

  const enCoursIngenieurs = filtres_.filter((d) => d.etat === S.EN_COURS);
  const assignesEnAttente = filtres_.filter((d) => d.etat === S.ASSIGNE);
  const bloques = filtres_.filter((d) => d.etat === S.ATTENTE_INFO);

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

        <PointDuMatin
          dossiers={dossiers}
          retoursHier={retoursHier}
          ingenieurs={options.ingenieurs}
          habilitations={options.habilitations}
          config={config}
        />

        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />

        <NavigationOnglets
          operations={options.operations}
          operationActive={filtres.operation}
          onChange={(op) => setFiltres((f) => ({ ...f, operation: op }))}
        />

        {/* Indicateurs, dans l'ordre du circuit d'un dossier */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPICard label="Dans la file" value={parEtat(S.FILE)} accent="neutral" icone="inbox" />
          <KPICard label="Assignés, pas commencés" value={parEtat(S.ASSIGNE)} accent="neutral" icone="user" />
          <KPICard label="En cours (ingénieurs)" value={parEtat(S.EN_COURS)} accent="brand" icone="pencil" />
          <KPICard label="En attente d'info" value={parEtat(S.ATTENTE_INFO)} accent="gold" icone="clock" />
          <KPICard label="À contrôler" value={parEtat(S.A_CONTROLER) + parEtat("En cours de vérification")} accent="gold" icone="shield" />
          <KPICard label="Validés" value={parEtat(S.VALIDE)} accent="green" icone="checkCircle" />
          <KPICard label="Total dossiers" value={filtres_.length} accent="brand" icone="folder" />
          <KPICard
            label="Délai moyen de contrôle"
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
            titre="Assignés, pas encore commencés"
            dossiers={assignesEnAttente}
            champPersonne="ingenieur"
            badgeTexte="en attente"
            icone="user"
          />
          <ChargeDetaillee
            titre="Bloqués en attente d'info"
            dossiers={bloques}
            champPersonne="ingenieur"
            badgeTexte="bloqués"
            icone="clock"
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
