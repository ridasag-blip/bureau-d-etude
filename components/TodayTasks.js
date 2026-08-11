"use client";

export default function TodayTasks({ dossiers }) {
  const enAttente = dossiers.filter((d) => ["En attente", "Encours", "Encours de vérif"].includes(d.etat));
  const ordrePriorite = { "Encours de vérif": 0, "Encours": 1, "En attente": 2 };
  const tries = [...enAttente].sort((a, b) => ordrePriorite[a.etat] - ordrePriorite[b.etat]);

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
        À traiter aujourd'hui ({tries.length})
      </p>
      <ul className="flex flex-col divide-y max-h-80 overflow-y-auto">
        {tries.map((d) => (
          <li key={d.id} className="py-2 text-sm flex justify-between items-center">
            <div>
              <p className="font-medium">{d.nom_dossier}</p>
              <p className="text-xs text-ink/40">{d.nom_operation} · {d.client}</p>
            </div>
            <span className="badge bg-isoGold/10 text-isoGold">{d.etat}</span>
          </li>
        ))}
        {tries.length === 0 && (
          <li className="py-6 text-center text-ink/40 text-sm">Rien en attente. 🎉</li>
        )}
      </ul>
    </div>
  );
}
