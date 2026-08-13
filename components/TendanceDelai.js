"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function TendanceDelai({ data }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
        Tendance délai de vérification (par semaine)
      </p>
      {data.length < 2 ? (
        <p className="text-sm text-ink/40 py-6 text-center">Pas encore assez de données.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="semaine" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} unit="h" />
            <Tooltip formatter={(v) => `${v.toFixed(1)}h`} />
            <Line type="monotone" dataKey="delaiMoyen" stroke="#2571AA" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
