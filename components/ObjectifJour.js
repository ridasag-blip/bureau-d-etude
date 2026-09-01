"use client";
import { useEffect, useState } from "react";

const AUJOURD_HUI_ISO = new Date().toISOString().slice(0, 10);

export default function ObjectifJour({ supabase, operations }) {
  const [ouvert, setOuvert] = useState(false);
  const [objectifs, setObjectifs] = useState({}); // { [operation]: { objectif_nv_dossier, objectif_modif } }

  useEffect(() => {
    if (!ouvert) return;
    (async () => {
      const { data } = await supabase
        .from("objectifs_journaliers")
        .select("*")
        .eq("date", AUJOURD_HUI_ISO);
      const map = {};
      (data || []).forEach((o) => (map[o.operation] = o));
      setObjectifs(map);
    })();
  }, [ouvert]);

  async function majObjectif(operation, champ, valeur) {
    const n = Number(valeur) || 0;
    setObjectifs((o) => ({
      ...o,
      [operation]: { ...(o[operation] || {}), [champ]: n },
    }));
    const actuel = objectifs[operation] || {};
    await supabase.from("objectifs_journaliers").upsert(
      {
        operation,
        date: AUJOURD_HUI_ISO,
        objectif_nv_dossier: champ === "objectif_nv_dossier" ? n : actuel.objectif_nv_dossier || 0,
        objectif_modif: champ === "objectif_modif" ? n : actuel.objectif_modif || 0,
      },
      { onConflict: "operation,date" }
    );
  }

  return (
    <div className="card p-4 mb-6">
      <button
        onClick={() => setOuvert(!ouvert)}
        className="text-xs font-semibold text-ink/50 uppercase tracking-wide flex items-center gap-2"
      >
        Objectif du jour par opération (optionnel) {ouvert ? "▾" : "▸"}
      </button>
      <p className="text-xs text-ink/40 mt-1">
        Partagé par toute l'équipe — à utiliser seulement les jours où tu veux répartir un volume
        précis par opération, sinon laisse vide.
      </p>

      {ouvert && (
        <div className="mt-4 overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className="text-left pr-4 pb-2 text-xs text-ink/50"></th>
                {operations.map((op) => (
                  <th key={op} className="px-3 pb-2 text-xs font-semibold text-ink/60 text-center whitespace-nowrap">
                    {op}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-4 py-1 text-xs text-ink/50 whitespace-nowrap">Nouveau dossier</td>
                {operations.map((op) => {
                  const obj = objectifs[op] || {};
                  return (
                    <td key={op} className="px-3 py-1 text-center">
                      <input
                        type="number"
                        min="0"
                        defaultValue={obj.objectif_nv_dossier || ""}
                        onBlur={(e) => majObjectif(op, "objectif_nv_dossier", e.target.value)}
                        className="border rounded-md px-2 py-1 w-16 text-sm text-center"
                      />
                    </td>
                  );
                })}
              </tr>
              <tr>
                <td className="pr-4 py-1 text-xs text-ink/50 whitespace-nowrap">Modif.</td>
                {operations.map((op) => {
                  const obj = objectifs[op] || {};
                  return (
                    <td key={op} className="px-3 py-1 text-center">
                      <input
                        type="number"
                        min="0"
                        defaultValue={obj.objectif_modif || ""}
                        onBlur={(e) => majObjectif(op, "objectif_modif", e.target.value)}
                        className="border rounded-md px-2 py-1 w-16 text-sm text-center"
                      />
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
