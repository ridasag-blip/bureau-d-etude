"use client";

export default function ConformitePremierCoup({ taux }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-2">
        Conformité 1er coup
      </p>
      {taux === null ? (
        <p className="text-sm text-ink/40">Pas encore de données.</p>
      ) : (
        <>
          <p className="font-display text-3xl font-bold text-isoGreen">{taux.toFixed(0)}%</p>
          <p className="text-xs text-ink/40 mt-1">Dossiers audités sans aucun retour</p>
        </>
      )}
    </div>
  );
}
