"use client";

export default function HeatmapHebdo({ data }) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
        Volume par jour de la semaine
      </p>
      <div className="flex items-end gap-2 h-32">
        {data.map((d) => {
          const hauteur = Math.max(8, (d.total / max) * 100);
          return (
            <div key={d.jour} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md bg-isoNavy"
                style={{ height: `${hauteur}%`, opacity: 0.3 + (d.total / max) * 0.7 }}
                title={`${d.jour} : ${d.total} dossier(s)`}
              />
              <span className="text-[10px] text-ink/50">{d.jour}</span>
              <span className="text-[10px] text-ink/30">{d.total}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
