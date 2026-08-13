"use client";
import { useState } from "react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function evolutionMensuelle(dossiers) {
  const map = {};
  for (const d of dossiers) {
    if (!d.date) continue;
    const date = new Date(d.date);
    const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    map[cle] = (map[cle] || 0) + 1;
  }
  return Object.entries(map)
    .map(([cle, total]) => {
      const [annee, mois] = cle.split("-");
      return { label: `${MOIS[Number(mois) - 1]} ${annee}`, cle, total };
    })
    .sort((a, b) => a.cle.localeCompare(b.cle))
    .slice(-12);
}

function repartitionPar(dossiers, champ) {
  const map = {};
  for (const d of dossiers) {
    const val = d[champ] || "—";
    map[val] = (map[val] || 0) + 1;
  }
  return Object.entries(map)
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total);
}

export default function GraphiquesPopup({ dossiers, onFermer }) {
  const [onglet, setOnglet] = useState("general");

  const dataGeneral = evolutionMensuelle(dossiers);
  const dataOperation = repartitionPar(dossiers, "nom_operation");
  const dataClient = repartitionPar(dossiers, "client");

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-6" onClick={onFermer}>
      <div className="card p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-display font-semibold text-lg">Graphiques de production</h3>
          <button onClick={onFermer} className="text-ink/40 hover:text-ink">✕</button>
        </div>

        <div className="flex gap-2 mb-6">
          {[
            ["general", "Général"],
            ["operation", "Par opération"],
            ["client", "Par client"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setOnglet(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium ${
                onglet === key ? "bg-isoGreen text-white" : "bg-white border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {onglet === "general" && (
          <div>
            <p className="text-xs text-ink/50 mb-3">Évolution mensuelle du volume de dossiers</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dataGeneral}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="total" stroke="#6BC94C" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {onglet === "operation" && (
          <div>
            <p className="text-xs text-ink/50 mb-3">Volume de dossiers par opération</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dataOperation} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#2571AA" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {onglet === "client" && (
          <div>
            <p className="text-xs text-ink/50 mb-3">Volume de dossiers par client</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dataClient} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="total" fill="#D4A017" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
