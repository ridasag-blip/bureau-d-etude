"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Icon from "@/components/ui/Icon";
import { S } from "@/lib/constants";

const CLE = "hillsolution_point_matin_replie";

/**
 * Résumé du matin : 5 lignes cliquables maximum, calculé à l'ouverture.
 * Les lignes sans rien à signaler ne s'affichent pas.
 */
export default function PointDuMatin({ dossiers, retoursHier, ingenieurs, habilitations, config }) {
  const [replie, setReplie] = useState(false);
  useEffect(() => {
    try {
      setReplie(window.localStorage.getItem(CLE) === new Date().toISOString().slice(0, 10));
    } catch {}
  }, []);
  function basculer() {
    const v = !replie;
    setReplie(v);
    try {
      if (v) window.localStorage.setItem(CLE, new Date().toISOString().slice(0, 10));
      else window.localStorage.removeItem(CLE);
    } catch {}
  }

  const h = (date) => (date ? (Date.now() - new Date(date).getTime()) / 3600000 : 0);
  const seuilControle = Number(config?.seuil_verification_heures) || 1;
  const delaiMax = Number(config?.delai_max_traitement_heures) || 24;

  const retardControle = dossiers.filter((d) => d.etat === S.A_CONTROLER && h(d.date_soumission) > seuilControle);
  const retardIngenieur = dossiers.filter((d) => d.etat === S.EN_COURS && h(d.date_acceptation) > delaiMax);
  const file = dossiers.filter((d) => d.etat === S.FILE);
  const bloques = dossiers.filter((d) => d.etat === S.ATTENTE_INFO);
  const occupes = new Set(dossiers.filter((d) => d.etat === S.EN_COURS).map((d) => d.ingenieur));
  const libres = ingenieurs.filter((i) => !occupes.has(i));

  const fileParFiche = {};
  for (const d of file) fileParFiche[d.nom_operation] = (fileParFiche[d.nom_operation] || 0) + 1;
  const fichesSansRenfort = Object.keys(fileParFiche).filter(
    (op) => !libres.some((i) => (habilitations?.[i] || []).includes(op))
  );

  const causes = {};
  for (const r of retoursHier) causes[r.cause] = (causes[r.cause] || 0) + 1;
  const topCause = Object.entries(causes).sort((a, b) => b[1] - a[1])[0];

  const lignes = [
    (retardControle.length || retardIngenieur.length) && {
      ton: "red",
      icone: "flame",
      href: "/qualite#section-aControler",
      texte: [
        retardControle.length && `${retardControle.length} dossier(s) attendent le contrôle depuis plus de ${seuilControle} h`,
        retardIngenieur.length && `${retardIngenieur.length} en cours depuis plus de ${delaiMax} h`,
      ]
        .filter(Boolean)
        .join(" · "),
    },
    retoursHier.length && {
      ton: "gold",
      icone: "undo",
      href: "/statistiques",
      texte: `${retoursHier.length} retour(s) hier${topCause ? ` — surtout « ${topCause[0]} » (${topCause[1]})` : ""}`,
    },
    {
      ton: file.length ? "brand" : "neutral",
      icone: "inbox",
      href: "/qualite#section-file",
      texte: file.length
        ? `${file.length} dossier(s) dans la file : ${Object.entries(fileParFiche)
            .sort((a, b) => b[1] - a[1])
            .map(([op, n]) => `${op} (${n})`)
            .join(", ")}`
        : "La file est vide",
    },
    bloques.length && {
      ton: "gold",
      icone: "clock",
      href: "/qualite#section-attenteInfo",
      texte: `${bloques.length} dossier(s) bloqué(s) en attente d'info`,
    },
    {
      ton: fichesSansRenfort.length ? "red" : "neutral",
      icone: "users",
      href: "/qualite",
      texte:
        (libres.length ? `Sans dossier en cours : ${libres.join(", ")}` : "Tous les ingénieurs ont un dossier en cours") +
        (fichesSansRenfort.length ? ` — aucun ingénieur habilité libre pour ${fichesSansRenfort.join(", ")}` : ""),
    },
  ].filter(Boolean);

  const TON = {
    red: "bg-isoRed-light text-isoRed",
    gold: "bg-isoGold-light text-isoGold-dark",
    brand: "bg-brand-50 text-brand-600",
    neutral: "bg-ink/[0.05] text-ink/50",
  };

  const jour = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="card mb-6 overflow-hidden">
      <button onClick={basculer} className="w-full card-header text-left" aria-expanded={!replie}>
        <span className="card-title">
          <Icon name="target" size={15} className="text-brand-500" />
          Point du matin
          <span className="text-ink/40 font-normal capitalize">— {jour}</span>
        </span>
        <Icon name="chevronDown" size={16} className={`text-ink/40 transition-transform ${replie ? "" : "rotate-180"}`} />
      </button>
      {!replie && (
        <ul className="border-t border-line divide-y divide-line">
          {lignes.map((l, i) => (
            <li key={i}>
              <Link href={l.href} className="flex items-center gap-3 px-5 py-2.5 text-sm hover:bg-paper transition-colors">
                <span className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${TON[l.ton]}`}>
                  <Icon name={l.icone} size={14} />
                </span>
                <span className="flex-1">{l.texte}</span>
                <Icon name="chevronRight" size={14} className="text-ink/25" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
