"use client";

export default function ChargeDetaillee({ titre, dossiers, champPersonne, badgeTexte }) {
  const groupes = {};
  for (const d of dossiers) {
    const cle = d[champPersonne];
    if (!cle) continue;
    if (!groupes[cle]) groupes[cle] = [];
    groupes[cle].push(d);
  }
  const entrees = Object.entries(groupes).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">{titre}</p>
      <div className="flex flex-col gap-4 max-h-80 overflow-y-auto">
        {entrees.map(([personne, liste]) => (
          <div key={personne}>
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-sm">{personne}</span>
              <span className="badge bg-isoNavy/10 text-isoNavy">{liste.length} {badgeTexte}</span>
            </div>
            <ul className="flex flex-col gap-0.5">
              {liste.map((d) => (
                <li key={d.id} className="text-xs text-ink/60 flex justify-between">
                  <span>{d.nom_dossier}</span>
                  <span className="text-ink/40">{d.nom_operation}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {entrees.length === 0 && (
          <p className="text-sm text-ink/40 text-center py-6">Rien en cours.</p>
        )}
      </div>
    </div>
  );
}
