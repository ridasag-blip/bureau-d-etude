"use client";

export default function Leaderboard({ classement }) {
  const trie = [...classement].sort(
    (a, b) => (b.stats.scoreGlobal ?? -1) - (a.stats.scoreGlobal ?? -1)
  );

  const medailles = ["🥇", "🥈", "🥉"];

  return (
    <div className="card p-4">
      <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">
        Classement — Score Global
      </p>
      <ul className="flex flex-col divide-y">
        {trie.map((row, i) => (
          <li key={row.ingenieur} className="flex items-center justify-between py-2 text-sm">
            <span className="flex items-center gap-2">
              <span className="w-5 text-center">{medailles[i] || i + 1}</span>
              {row.ingenieur}
            </span>
            <span className="font-display font-semibold">
              {row.stats.scoreGlobal ?? "—"}
              <span className="text-ink/30 text-xs">/100</span>
            </span>
          </li>
        ))}
        {trie.length === 0 && (
          <li className="py-6 text-center text-ink/40 text-sm">Pas encore de données.</li>
        )}
      </ul>
    </div>
  );
}
