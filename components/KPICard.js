"use client";

export default function KPICard({ label, value, previousValue, accent = "green" }) {
  const accentClass = {
    green: "text-isoGreen",
    red: "text-isoRed",
    navy: "text-isoNavy",
    gold: "text-isoGold",
  }[accent];

  let tendance = null;
  if (previousValue !== undefined && previousValue !== null && previousValue !== 0) {
    const delta = value - previousValue;
    const pct = Math.round((delta / previousValue) * 100);
    tendance = { delta, pct, positif: delta >= 0 };
  }

  return (
    <div className="card p-4 flex flex-col gap-1 min-w-[140px]">
      <span className="text-xs font-medium text-ink/50 uppercase tracking-wide whitespace-pre-line">
        {label}
      </span>
      <div className="flex items-end gap-2">
        <span className={`font-display text-3xl font-bold ${accentClass}`}>{value ?? 0}</span>
        {tendance && (
          <span
            className={`text-xs font-semibold mb-1 ${
              tendance.positif ? "text-isoGreen" : "text-isoRed"
            }`}
            title="Vs mois précédent"
          >
            {tendance.positif ? "↑" : "↓"} {Math.abs(tendance.pct)}%
          </span>
        )}
      </div>
    </div>
  );
}
