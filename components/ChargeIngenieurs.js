"use client";

export default function ChargeIngenieurs({ charge }) {
  const lignes = Object.entries(charge).sort((a, b) => b[1] - a[1]);

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
        Charge actuelle par ingénieur
      </p>
      <ul className="flex flex-col divide-y">
        {lignes.map(([ingenieur, n]) => (
          <li key={ingenieur} className="flex justify-between items-center py-2 text-sm">
            <span>{ingenieur}</span>
            <span className="badge bg-isoNavy/10 text-isoNavy">{n} en cours</span>
          </li>
        ))}
        {lignes.length === 0 && (
          <li className="py-6 text-center text-ink/40 text-sm">Aucun dossier en cours.</li>
        )}
      </ul>
    </div>
  );
}
