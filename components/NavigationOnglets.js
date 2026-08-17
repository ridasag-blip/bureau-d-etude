"use client";

export default function NavigationOnglets({ operations, operationActive, onChange }) {
  return (
    <div className="card p-4 mb-6">
      <p className="font-display font-semibold">Navigation par onglets</p>
      <p className="text-sm text-ink/50 mb-3">Filtre rapide pour se concentrer sur une famille de dossiers.</p>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onChange("Tous")}
          className={`px-4 py-1.5 rounded-full text-sm font-medium ${
            operationActive === "Tous" ? "bg-isoGreen-light text-isoGreen-dark" : "bg-white border"
          }`}
        >
          Tous
        </button>
        {operations.map((op) => (
          <button
            key={op}
            onClick={() => onChange(op)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${
              operationActive === op ? "bg-isoGreen-light text-isoGreen-dark" : "bg-white border"
            }`}
          >
            {op}
          </button>
        ))}
      </div>
    </div>
  );
}
