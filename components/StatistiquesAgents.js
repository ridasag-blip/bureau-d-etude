"use client";
import Leaderboard from "@/components/Leaderboard";
import TopCausesChart from "@/components/TopCausesChart";
import KPICard from "@/components/KPICard";
import Avatar from "@/components/ui/Avatar";
import Icon from "@/components/ui/Icon";
import { topCausesDepuisRetours } from "@/lib/scoring";
import { statsParIngenieur } from "@/lib/statsAgents";
import { formatDuree } from "@/lib/constants";

const TON_ATTEINTE = {
  Atteint: "green",
  "Partiellement atteint": "gold",
  "Non atteint": "red",
};

function Score({ valeur, max }) {
  if (valeur === null || valeur === undefined) return <span className="text-ink/25">—</span>;
  const pct = Math.max(0, Math.min(100, (valeur / max) * 100));
  const couleur = pct >= 80 ? "bg-isoGreen" : pct >= 50 ? "bg-[#D09A2E]" : "bg-isoRed";
  return (
    <div className="flex items-center gap-2 justify-end">
      <div className="w-12 h-1.5 rounded-full bg-ink/[0.06] overflow-hidden">
        <div className={`h-full rounded-full ${couleur}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-semibold tabular w-7 text-right">{Math.round(valeur)}</span>
    </div>
  );
}

/**
 * Rubrique « Statistiques agents » du Dashboard : scores qualité / productivité
 * par ingénieur, classement et top causes de retour, sur les dossiers filtrés.
 */
export default function StatistiquesAgents({ dossiersFiltres, traitements, filtres, objectifs, retours, noms, qualite = [] }) {
  const estQualite = (n) => qualite.some((q) => String(q).trim().toLowerCase() === String(n || "").trim().toLowerCase());
  // Un dossier compte le jour où il est audité ; chaque retour client = une modif ; les retours comptent le jour où ils sont faits
  const lignes = statsParIngenieur({ dossiersFiltres, traitements, retours, filtres, objectifs, noms }).sort(
    (x, y) => y.stats.dossierTraiteTotal - x.stats.dossierTraiteTotal || x.ingenieur.localeCompare(y.ingenieur)
  );
  const retoursFiltres = lignes.flatMap((l) => l.retours);

  const totalTraite = lignes.reduce((s, l) => s + l.stats.dossierTraiteTotal, 0);
  const totalRetInt = lignes.reduce((s, l) => s + l.stats.nbRetourInterne, 0);
  const totalRetCli = lignes.reduce((s, l) => s + l.stats.nbRetourClient, 0);
  const scores = lignes.map((l) => l.stats.scoreGlobal).filter((v) => v !== null && v !== undefined);
  const scoreMoyen = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  return (
    <>
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KPICard label="Dossiers traités" value={totalTraite} accent="brand" icone="folder" />
          <KPICard label="Retours internes" value={totalRetInt} accent="gold" icone="undo" />
          <KPICard label="Retours client" value={totalRetCli} accent="red" icone="building" />
          <KPICard label="Score global moyen" value={scoreMoyen ?? "—"} accent="green" icone="trophy" />
        </section>

        <div className="card overflow-x-auto mb-6">
          <div className="card-header">
            <p className="card-title">
              <Icon name="users" size={15} className="text-ink/40" />
              Détail par ingénieur
            </p>
            <span className="text-xs text-ink/45">Comptés le jour de l’audit · 1 modif = 1 dossier · chaque retour interne pénalise · qualité /50 + quantité /50</span>
          </div>
          <table className="table table-hover [&_td]:px-2.5 [&_th]:px-2.5 [&_th]:tracking-normal">
            <thead>
              <tr>
                <th>Ingénieur</th>
                <th className="!text-right">Objectif</th>
                <th className="!text-right" title="Nouveaux dossiers audités">Nouveaux</th>
                <th className="!text-right" title="Modifs auditées (une par modif, quel que soit le nombre de retours)">Modifs</th>
                <th className="!text-right">Total audité</th>
                <th className="!text-right" title="Dossiers en plusieurs versions (V1, V2…) : chacun compte pour 1 dossier">dont multi-versions</th>
                <th className="!text-right" title="Chaque retour interne compte (avant ou après audit)">Ret. int.</th>
                <th className="!text-right" title="Dossiers ayant eu au moins un retour interne">Dossiers avec retour</th>
                <th className="!text-right" title="Dossiers audités sans aucun retour interne">1er coup</th>
                <th className="!text-right" title="Demandes du client (pas une faute)">Ret. client</th>
                <th className="!text-right" title="Temps passé par version, pauses exclues (un dossier en 2 versions : temps ÷ 2)">Temps / version</th>
                <th className="!text-right">Qualité</th>
                <th className="!text-right" title="Par rapport à l'objectif s'il est saisi, sinon au meilleur total de l'équipe">Quantité</th>
                <th className="!text-right">Global</th>
              </tr>
            </thead>
            <tbody className="tabular">
              {lignes.map(({ ingenieur, stats, objectif }) => (
                <tr key={ingenieur}>
                  <td>
                    <span className="flex items-center gap-2 font-semibold capitalize whitespace-nowrap">
                      <Avatar nom={ingenieur} taille={26} />
                      {ingenieur}
                      {estQualite(ingenieur) && <span className="badge badge-green text-[10px] ml-1" title="Service qualité qui traite aussi des dossiers">Qualité</span>}
                    </span>
                  </td>
                  <td className="text-right text-ink/50">
                    {objectif ? `${objectif.objectif_nv_dossier}/${objectif.objectif_modif}` : "—"}
                  </td>
                  <td className="text-right">{stats.nvDossierTraite}</td>
                  <td className="text-right">{stats.modifTraite}</td>
                  <td className="text-right font-semibold">{stats.dossierTraiteTotal}</td>
                  <td className={`text-right ${stats.multiVersions ? "text-[#5B3FA3] font-semibold" : "text-ink/40"}`}>{stats.multiVersions || 0}</td>
                  <td className={`text-right ${stats.nbRetourInterne ? "text-isoGold-dark font-semibold" : "text-ink/40"}`}>
                    {stats.nbRetourInterne}
                  </td>
                  <td className="text-right text-ink/65">{stats.dossiersAvecRetour}</td>
                  <td className="text-right whitespace-nowrap">{stats.premierCoup === null ? "—" : `${stats.premierCoup} %`}</td>
                  <td className={`text-right ${stats.nbRetourClient ? "text-isoRed-dark font-semibold" : "text-ink/40"}`}>
                    {stats.nbRetourClient}
                  </td>
                  <td className="text-right text-ink/65 whitespace-nowrap">
                    {stats.tempsMoyenHeures !== null ? formatDuree(stats.tempsMoyenHeures) : "—"}
                  </td>
                  <td>
                    <Score valeur={stats.scoreQualite} max={50} />
                  </td>
                  <td>
                    <Score valeur={stats.scoreQuantite} max={50} />
                  </td>
                  <td className="text-right">
                    {stats.scoreGlobal !== null ? (
                      <span className="inline-flex items-center justify-center min-w-[44px] h-7 px-2 rounded-lg bg-brand-50 text-brand-700 font-display font-extrabold">
                        {stats.scoreGlobal.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-ink/25">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {lignes.length === 0 && (
                <tr>
                  <td colSpan={14} className="table-empty">Aucune donnée pour ces filtres.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <Leaderboard classement={lignes} />
          <TopCausesChart data={topCausesDepuisRetours(retoursFiltres)} />
        </div>
    </>
  );
}
