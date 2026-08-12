"use client";
import { useMemo, useState } from "react";

const initial = {
  date: new Date().toISOString().slice(0, 10),
  nom_dossier: "",
  ingenieur: "",
  nom_operation: "",
  client: "",
  nature_prod: "",
  commentaire: "",
};

export default function DossierFormSaisie({ options, dossiersExistants, chargeParIngenieur, onSubmit, roleActuel, ingenieurConnecte }) {
  const [form, setForm] = useState({
    ...initial,
    ingenieur: roleActuel === "ingenieur" ? ingenieurConnecte : "",
  });
  const [envoi, setEnvoi] = useState(false);

  const doublonPotentiel = useMemo(() => {
    if (!form.nom_dossier.trim()) return null;
    return dossiersExistants?.find(
      (d) => d.nom_dossier?.trim().toUpperCase() === form.nom_dossier.trim().toUpperCase()
    );
  }, [form.nom_dossier, dossiersExistants]);

  function champ(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function envoyer(e) {
    e.preventDefault();
    setEnvoi(true);
    try {
      await onSubmit(form);
      setForm({ ...initial, ingenieur: roleActuel === "ingenieur" ? ingenieurConnecte : "" });
    } finally {
      setEnvoi(false);
    }
  }

  return (
    <form onSubmit={envoyer} className="card p-6 flex flex-col gap-5 max-w-3xl">
      <div>
        <h2 className="font-display text-lg font-semibold">Nouvelle saisie — Dispatching</h2>
        <p className="text-sm text-ink/50">
          Assigne un dossier à un ingénieur. Le retour qualité se fait ensuite dans « Vérification ».
        </p>
      </div>

      {doublonPotentiel && (
        <div className="bg-isoGold/10 border border-isoGold text-isoGold-dark text-sm rounded-md px-3 py-2">
          ⚠️ Un dossier nommé « {doublonPotentiel.nom_dossier} » existe déjà (saisi le{" "}
          {doublonPotentiel.date}, par {doublonPotentiel.ingenieur}). Vérifie qu'il ne s'agit pas
          d'un doublon avant d'enregistrer.
        </div>
      )}

      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="text-xs font-semibold text-isoGreen uppercase mb-2 col-span-2">
          Informations générales
        </legend>
        <Champ label="Date" type="date" value={form.date} onChange={(v) => champ("date", v)} required />
        <Champ label="Nom dossier" value={form.nom_dossier} onChange={(v) => champ("nom_dossier", v)} required />

        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Ingénieur</label>
          <select
            required
            disabled={roleActuel === "ingenieur"}
            className="border rounded-md px-2 py-1.5 text-sm disabled:bg-black/5"
            value={form.ingenieur}
            onChange={(e) => champ("ingenieur", e.target.value)}
          >
            <option value="">—</option>
            {options.ingenieurs?.map((o) => (
              <option key={o} value={o}>
                {o} {chargeParIngenieur?.[o] ? `(${chargeParIngenieur[o]} en cours)` : ""}
              </option>
            ))}
          </select>
        </div>

        <ChampSelect
          label="Nom de l'opération"
          value={form.nom_operation}
          onChange={(v) => champ("nom_operation", v)}
          options={options.operations}
          required
        />
        <ChampSelect label="Client" value={form.client} onChange={(v) => champ("client", v)} options={options.clients} />
        <ChampSelect
          label="Nature production"
          value={form.nature_prod}
          onChange={(v) => champ("nature_prod", v)}
          options={options.naturesProd}
          required
        />
      </fieldset>

      <div>
        <Champ label="Commentaire (optionnel)" value={form.commentaire} onChange={(v) => champ("commentaire", v)} textarea />
      </div>

      <button type="submit" disabled={envoi} className="btn-primary self-start disabled:opacity-50">
        {envoi ? "Enregistrement…" : "Assigner le dossier"}
      </button>
    </form>
  );
}

function Champ({ label, value, onChange, type = "text", required, textarea }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink/50">{label}</label>
      {textarea ? (
        <textarea
          className="border rounded-md px-2 py-1.5 text-sm"
          rows={3}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          type={type}
          required={required}
          className="border rounded-md px-2 py-1.5 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ChampSelect({ label, value, onChange, options = [], required }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink/50">{label}</label>
      <select
        required={required}
        className="border rounded-md px-2 py-1.5 text-sm"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">—</option>
        {options?.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
