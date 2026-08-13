"use client";
import { MOIS } from "@/lib/constants";

export default function FilterBar({ filtres, setFiltres, options }) {
  const { ingenieurs = [], operations = [], clients = [] } = options || {};
  const annees = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  function update(champ, valeur) {
    setFiltres((f) => ({ ...f, [champ]: valeur }));
  }

  return (
    <div className="card p-4 mb-6">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
        Filtrer
      </p>
      <div className="flex flex-wrap gap-3">
        <Select label="Mois" value={filtres.mois} onChange={(v) => update("mois", v)}>
          <option value="Tous">Tous</option>
          {MOIS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </Select>

        <Select label="Année" value={filtres.annee} onChange={(v) => update("annee", v)}>
          <option value="Tous">Tous</option>
          {annees.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </Select>

        <Select label="Opération" value={filtres.operation} onChange={(v) => update("operation", v)}>
          <option value="Tous">Tous</option>
          {operations.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </Select>

        <Select label="Client" value={filtres.client} onChange={(v) => update("client", v)}>
          <option value="Tous">Tous</option>
          {clients.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>

        <Select label="Ingénieur" value={filtres.ingenieur} onChange={(v) => update("ingenieur", v)}>
          <option value="Tous">Tous</option>
          {ingenieurs.map((i) => (
            <option key={i} value={i}>{i}</option>
          ))}
        </Select>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Du</label>
          <input
            type="date"
            className="border rounded-md px-2 py-1.5 text-sm"
            value={filtres.du || ""}
            onChange={(e) => update("du", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Au</label>
          <input
            type="date"
            className="border rounded-md px-2 py-1.5 text-sm"
            value={filtres.au || ""}
            onChange={(e) => update("au", e.target.value)}
          />
        </div>
      </div>
    </div>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink/50">{label}</label>
      <select
        className="border rounded-md px-2 py-1.5 text-sm min-w-[130px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}
