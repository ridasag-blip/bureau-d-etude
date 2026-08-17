"use client";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function debutSemaine() {
  const auj = new Date();
  const jour = auj.getDay(); // 0=Dim
  const decalage = jour === 0 ? -6 : 1 - jour; // ramène au lundi
  const lundi = new Date(auj);
  lundi.setDate(auj.getDate() + decalage);
  lundi.setHours(0, 0, 0, 0);
  return lundi;
}

export default function VueCalendrier({ dossiers }) {
  const lundi = debutSemaine();
  const jours = JOURS.map((label, i) => {
    const date = new Date(lundi);
    date.setDate(lundi.getDate() + i);
    const dateIso = date.toISOString().slice(0, 10);
    const dossiersDuJour = dossiers.filter((d) => d.date === dateIso);
    return { label, dateIso, jourNum: date.getDate(), dossiers: dossiersDuJour };
  });

  return (
    <div className="grid grid-cols-7 gap-2 mb-8">
      {jours.map((j) => (
        <div key={j.dateIso} className="card p-2 min-h-[140px]">
          <p className="text-xs font-semibold text-ink/50 text-center">{j.label} {j.jourNum}</p>
          <div className="mt-2 flex flex-col gap-1">
            {j.dossiers.map((d) => (
              <div
                key={d.id}
                className={`text-[10px] rounded px-1.5 py-1 truncate ${
                  d.retour_interne || d.retour_client ? "bg-isoRed/10 text-isoRed" : "bg-isoNavy/10 text-isoNavy"
                }`}
                title={d.nom_dossier}
              >
                {d.nom_dossier}
              </div>
            ))}
            {j.dossiers.length === 0 && <p className="text-[10px] text-ink/30 text-center mt-4">—</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
