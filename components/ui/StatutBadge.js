import { ETATS } from "@/lib/constants";

const CLASSE_TON = {
  neutral: "badge-neutral",
  brand: "badge-brand",
  green: "badge-green",
  gold: "badge-gold",
  red: "badge-red",
  dark: "badge-red",
};

/** Badge d'état de dossier — même rendu partout dans l'app. */
export default function StatutBadge({ etat, complet = false }) {
  const meta = ETATS[etat] || { court: etat || "—", ton: "neutral" };
  return (
    <span className={`badge badge-dot ${CLASSE_TON[meta.ton]}`} title={etat}>
      {complet ? etat : meta.court}
    </span>
  );
}

export function Badge({ ton = "neutral", children, dot = false, className = "" }) {
  return (
    <span className={`badge ${dot ? "badge-dot" : ""} ${CLASSE_TON[ton]} ${className}`}>{children}</span>
  );
}
