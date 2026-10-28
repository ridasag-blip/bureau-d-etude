"use client";
import { libellePassages, libelleVersions } from "@/lib/regroupement";

/** Case « Voir chaque passage » : décochée = une ligne par dossier (passages regroupés). */
export function BasculePassages({ valeur, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-[13px] text-ink/65 cursor-pointer whitespace-nowrap" title="Un dossier revenu en modification a une ligne par passage. Décoché : une seule ligne par dossier (même nom, client et fiche).">
      <input type="checkbox" className="w-4 h-4" checked={valeur} onChange={(e) => onChange(e.target.checked)} />
      Voir chaque version / passage
    </label>
  );
}

/** Filtre « Multi-versions » : seulement les dossiers en plusieurs versions (V1, V2…). */
export function BasculeMulti({ valeur, onChange }) {
  return (
    <label className="flex items-center gap-1.5 text-[13px] text-ink/65 cursor-pointer whitespace-nowrap" title="N'afficher que les dossiers en plusieurs versions">
      <input type="checkbox" className="w-4 h-4" checked={valeur} onChange={(e) => onChange(e.target.checked)} />
      Multi-versions
    </label>
  );
}

/** Pastilles « 2 versions · V1 + V2 » et « 3 passages · 2 ingénieurs » ; un clic ouvre l'historique complet. */
export function PastillePassages({ info, onClick }) {
  const texte = libellePassages(info);
  const versions = libelleVersions(info);
  if (!texte && !versions) return null;
  const ouvrir = (e) => {
    e.stopPropagation();
    onClick?.();
  };
  return (
    <>
      {versions && (
        <button type="button" className="badge badge-versions" title="Dossier en plusieurs versions : compte pour 1 dossier (facturation, statistiques). Ouvrir l'historique." onClick={ouvrir}>
          {versions}
        </button>
      )}
      {texte && <PastilleTexte texte={texte} onClick={ouvrir} />}
    </>
  );
}

function PastilleTexte({ texte, onClick }) {
  return (
    <button
      type="button"
      className="badge badge-brand hover:bg-brand-100"
      title="Ce dossier est revenu en modification : ouvrir l'historique de tous ses passages"
      onClick={onClick}
    >
      {texte}
    </button>
  );
}

/** Pastille « 2 versions » d'une ligne seule (champ « Nombre de versions »). */
export function PastilleVersions({ n }) {
  if (!n || n < 2) return null;
  return (
    <span className="badge badge-versions" title="Dossier en plusieurs versions : compte pour 1 dossier, délai multiplié">
      {n} versions
    </span>
  );
}
