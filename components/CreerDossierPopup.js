"use client";
import DossierFormSaisie from "@/components/DossierFormSaisie";

export default function CreerDossierPopup({ options, dossiersExistants, chargeParIngenieur, onSubmit, roleActuel, ingenieurConnecte, onFermer }) {
  async function soumettreEtFermer(form) {
    await onSubmit(form);
    onFermer();
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40 p-6" onClick={onFermer}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end mb-2">
          <button
            onClick={onFermer}
            className="w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-ink/50 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <DossierFormSaisie
          options={options}
          dossiersExistants={dossiersExistants}
          chargeParIngenieur={chargeParIngenieur}
          onSubmit={soumettreEtFermer}
          roleActuel={roleActuel}
          ingenieurConnecte={ingenieurConnecte}
        />
      </div>
    </div>
  );
}
