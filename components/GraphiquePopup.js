"use client";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from "recharts";

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

function nouveauxVsModifications(dossiers) {
  const map = {};
  for (const d of dossiers) {
    if (!d.date) continue;
    const date = new Date(d.date);
    const cle = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    if (!map[cle]) map[cle] = { nouveau: 0, modification: 0 };
    if (d.nature_prod === "Nouveau dossier") map[cle].nouveau += 1;
    else if (d.nature_prod === "Modification") map[cle].modification += 1;
  }
  return Object.entries(map)
    .map(([cle, v]) => {
      const [annee, mois] = cle.split("-");
      return { label: `${MOIS[Number(mois) - 1]} ${annee}`, cle, Nouveau: v.nouveau, Modification: v.modification };
    })
    .sort((a, b) => a.cle.localeCompare(b.cle))
    .slice(-12);
}

const CONFIG = {
  evolution: { titre: "Évolution mensuelle", sousTitre: "Évolution mensuelle du volume de dossiers" },
  operation: { titre: "Répartition opération", sousTitre: "Volume de dossiers par opération" },
  client: { titre: "Vue clients", sousTitre: "Volume de dossiers par client" },
  nature: { titre: "Nouveaux vs Modifications", sousTitre: "Comparaison mensuelle du volume par nature" },
};

export default function GraphiquePopup({ type, dossiers, onFermer }) {
  const config = CONFIG[type];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-6" onClick={onFermer}>
      <div className="card p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <h3 className="font-display font-semibold text-lg">{config.titre}</h3>
          <button onClick={onFermer} className="text-ink/40 hover:text-ink">✕</button>
        </div>
        <p className="text-xs text-ink/50 mb-3">{config.sousTitre}</p>

        {type === "evolution" && (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={evolutionMensuelle(dossiers)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#6BC94C" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {type === "operation" && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={repartitionPar(dossiers, "nom_operation")} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#2571AA" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {type === "client" && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={repartitionPar(dossiers, "client")} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="total" fill="#D4A017" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {type === "nature" && (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={nouveauxVsModifications(dossiers)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="Nouveau" fill="#6BC94C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Modification" fill="#2571AA" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
