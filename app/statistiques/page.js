"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import Navbar from "@/components/Navbar";
import FilterBar from "@/components/FilterBar";
import SelectionPersonne from "@/components/SelectionPersonne";
import Leaderboard from "@/components/Leaderboard";
import TopCausesChart from "@/components/TopCausesChart";
import { useAppData, appliquerFiltres, FILTRES_INITIAUX } from "@/lib/useAppData";
import { useValidateurActif } from "@/lib/useValidateurActif";
import { grouperParIngenieur, calculerStatsIngenieur, topCausesRetour } from "@/lib/scoring";

export default function StatistiquesPage() {
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
  const parIngenieur = grouperParIngenieur(filtres_);
  const lignes = Object.entries(parIngenieur).map(([ingenieur, dossiersIng]) => ({
    ingenieur,
    stats: calculerStatsIngenieur(dossiersIng, objectifs[ingenieur]),
  }));

  return (
    <div>
      <Navbar role={profile.role} nom={nomActif} onChangerPersonne={estAdmin ? undefined : changerDePersonne} />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="font-display text-2xl font-bold mb-1">Statistiques</h1>
        <p className="text-ink/50 mb-6">Qualité et suivi (Q) par ingénieur.</p>

        <FilterBar filtres={filtres} setFiltres={setFiltres} options={options} />

        <div className="card overflow-x-auto mb-8">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="text-left text-xs text-ink/50 uppercase bg-black/[0.03]">
                <th className="px-3 py-2 border border-black/10">Ingénieur</th>
                <th className="px-3 py-2 border border-black/10">Objectif</th>
                <th className="px-3 py-2 border border-black/10">Nv. dossier</th>
                <th className="px-3 py-2 border border-black/10">Modif.</th>
                <th className="px-3 py-2 border border-black/10">Total traité</th>
                <th className="px-3 py-2 border border-black/10">Atteinte</th>
                <th className="px-3 py-2 border border-black/10">Retour int.</th>
                <th className="px-3 py-2 border border-black/10">Retour client</th>
                <th className="px-3 py-2 border border-black/10">Délai moy.</th>
                <th className="px-3 py-2 border border-black/10">Score Qualité</th>
                <th className="px-3 py-2 border border-black/10">Score Product.</th>
                <th className="px-3 py-2 border border-black/10">Score Global</th>
              </tr>
            </thead>
            <tbody>
              {lignes.map(({ ingenieur, stats }) => (
                <tr key={ingenieur} className="border border-black/10">
                  <td className="px-3 py-2 border border-black/10 font-medium">{ingenieur}</td>
                  <td className="px-3 py-2 border border-black/10 text-ink/50">
                    {objectifs[ingenieur]
                      ? `${objectifs[ingenieur].objectif_nv_dossier}/${objectifs[ingenieur].objectif_modif}`
                      : "—"}
                  </td>
                  <td className="px-3 py-2 border border-black/10">{stats.nvDossierTraite}</td>
                  <td className="px-3 py-2 border border-black/10">{stats.modifTraite}</td>
                  <td className="px-3 py-2 border border-black/10">{stats.dossierTraiteTotal}</td>
                  <td className="px-3 py-2 border border-black/10">
                    <span
                      className={`badge ${
                        stats.statutAtteinte === "Atteint"
                          ? "bg-isoGreen/10 text-isoGreen"
                          : stats.statutAtteinte === "Partiellement atteint"
                          ? "bg-isoGold/10 text-isoGold"
                          : stats.statutAtteinte === "Non atteint"
                          ? "bg-isoRed/10 text-isoRed"
                          : "bg-black/5 text-ink/40"
                      }`}
                    >
                      {stats.statutAtteinte}
                    </span>
                  </td>
                  <td className="px-3 py-2 border border-black/10">{stats.nbRetourInterne}</td>
                  <td className="px-3 py-2 border border-black/10">{stats.nbRetourClient}</td>
                  <td className="px-3 py-2 border border-black/10">
                    {stats.delaiMoyenJours !== null ? `${stats.delaiMoyenJours.toFixed(1)} j` : "—"}
                  </td>
                  <td className="px-3 py-2 border border-black/10 font-semibold">
                    {stats.scoreQualite !== null ? stats.scoreQualite.toFixed(0) : "—"}
                  </td>
                  <td className="px-3 py-2 border border-black/10 font-semibold">
                    {stats.scoreProductivite !== null ? stats.scoreProductivite : "—"}
                  </td>
                  <td className="px-3 py-2 border border-black/10 font-display font-bold text-isoGreen">
                    {stats.scoreGlobal !== null ? stats.scoreGlobal.toFixed(0) : "—"}
                  </td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-ink/40 border border-black/10">
                    Aucune donnée pour ces filtres.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Leaderboard classement={lignes} />
          <TopCausesChart data={topCausesRetour(filtres_)} />
        </div>
      </main>
    </div>
  );
}
