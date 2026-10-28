"use client";
import { formatDuree } from "@/lib/constants";
import { heuresTraitementFini } from "@/lib/tempsTraitement";
import { numVersion } from "@/lib/versions";

/**
 * Panneau « Versions de ce dossier » (V1, V2…).
 *  · lignes sœurs (suffixe -v1 / -v2) : liste des versions avec statut, ingénieur et temps ;
 *  · ligne unique : nombre de versions modifiable (champ nb_versions).
 * Le dossier compte pour 1 dossier ; le temps est comparé par version.
 */
export default function BlocVersions({ d, versions, nbVersions, onChanger, modifiable = true }) {
  const lignes = (versions || [d]).slice().sort((a, b) => (numVersion(a.nom_dossier) || 0) - (numVersion(b.nom_dossier) || 0));
  const plusieursLignes = lignes.length > 1;
  if (!plusieursLignes && nbVersions < 2 && !modifiable) return null;

  const temps = lignes.map((x) => heuresTraitementFini(x)).filter((h) => h != null && h > 0);
  const total = temps.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-[#DCD0F5] bg-[#F8F5FE] p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[#5B3FA3]">Versions de ce dossier</p>
        {!plusieursLignes && modifiable && (
          <label className="flex items-center gap-1.5 text-[12px] text-ink/65">
            Nombre de versions
            <select
              className="input !py-0.5 !px-1.5 !text-[12px] !w-auto"
              value={nbVersions}
              onChange={(e) => onChanger?.(d, Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>
      {plusieursLignes ? (
        <ul className="flex flex-col gap-1">
          {lignes.map((x) => {
            const h = heuresTraitementFini(x);
            const n = numVersion(x.nom_dossier);
            return (
              <li key={x.id} className={`flex items-center gap-2 text-[12px] ${x.id === d.id ? "font-semibold" : ""}`}>
                <span className="badge badge-versions">{n ? `V${n}` : "—"}</span>
                <span className="text-ink/70 flex-1 truncate">{x.ingenieur_modif || x.ingenieur || "Non assigné"}</span>
                <span className="text-ink/55">{x.etat}</span>
                <span className="text-ink/55 w-14 text-right">{h ? formatDuree(h) : "—"}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        nbVersions > 1 && <p className="text-[12px] text-ink/65">{nbVersions} versions dans ce dossier.</p>
      )}
      {(plusieursLignes || nbVersions > 1) && (
        <p className="text-[11.5px] text-ink/55">
          Compte pour 1 dossier (facturation, statistiques)
          {total > 0 && ` · temps total ${formatDuree(total)} · ${formatDuree(total / Math.max(nbVersions, lignes.length))} par version`}
        </p>
      )}
    </div>
  );
}
