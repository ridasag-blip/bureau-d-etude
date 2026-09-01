"use client";

export default function ChargeParIngenieurTable({ ingenieurs, dossiersEnCours }) {
  function dossierDe(ing) {
    return dossiersEnCours.find((d) => d.ingenieur === ing) || null;
  }

  function depuis(d) {
    if (!d?.date_acceptation) return "—";
    const heures = (Date.now() - new Date(d.date_acceptation).getTime()) / 3600000;
    if (heures < 1) return `${Math.round(heures * 60)} min`;
    return `${heures.toFixed(1)}h`;
  }

  return (
    <div className="card overflow-x-auto">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide px-4 pt-4 pb-2">
        Charge actuelle par ingénieur
      </p>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs text-ink/50 uppercase bg-black/[0.03]">
            <th className="px-4 py-2 border border-black/10">Ingénieur</th>
            <th className="px-4 py-2 border border-black/10">Dossier en cours</th>
            <th className="px-4 py-2 border border-black/10">Opération</th>
            <th className="px-4 py-2 border border-black/10">Client</th>
            <th className="px-4 py-2 border border-black/10">Nature</th>
            <th className="px-4 py-2 border border-black/10">Depuis</th>
          </tr>
        </thead>
        <tbody>
          {ingenieurs.map((ing) => {
            const d = dossierDe(ing);
            return (
              <tr key={ing} className="border border-black/10">
                <td className="px-4 py-2 border border-black/10 font-medium">{ing}</td>
                <td className="px-4 py-2 border border-black/10">{d?.nom_dossier || <span className="text-ink/30">—</span>}</td>
                <td className="px-4 py-2 border border-black/10">{d?.nom_operation || "—"}</td>
                <td className="px-4 py-2 border border-black/10">{d?.client || "—"}</td>
                <td className="px-4 py-2 border border-black/10 text-ink/60">{d?.nature_prod || "—"}</td>
                <td className="px-4 py-2 border border-black/10 text-ink/60">{depuis(d)}</td>
              </tr>
            );
          })}
          {ingenieurs.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-ink/40 border border-black/10">Aucun ingénieur.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
