"use client";
import { useMemo, useState } from "react";

const initial = {
  date: new Date().toISOString().slice(0, 10),
  nom_dossier: "",
  ingenieur: "",
  nom_operation: "",
  client: "",
  etat: "",
  nature_prod: "",
  retour_interne: false,
  cause_retour_interne: "",
  retour_client: false,
  cause_retour_client: "",
  date_retour_client: "",
  date_nouvelle_modification: "",
  ingenieur_modif: "",
  commentaire: "",
  valide_par: "",
};

export default function DossierForm({ options, dossiersExistants, onSubmit, roleActuel, ingenieurConnecte }) {
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

  // Validation à la saisie : "Audité" exige un "Validé par"
  const erreurValidation =
    form.etat === "Audité" && !form.valide_par
      ? "Un dossier « Audité » doit avoir un « Validé par » renseigné."
      : null;

  function champ(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function envoyer(e) {
    e.preventDefault();
    if (erreurValidation) return;
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
        <h2 className="font-display text-lg font-semibold">Nouvelle saisie</h2>
        <p className="text-sm text-ink/50">Informations générales, production et retour dossier.</p>
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

        <ChampSelect
          label="Ingénieur"
          value={form.ingenieur}
          onChange={(v) => champ("ingenieur", v)}
          options={options.ingenieurs}
          disabled={roleActuel === "ingenieur"}
          required
        />
        <ChampSelect
          label="Nom de l'opération"
          value={form.nom_operation}
          onChange={(v) => champ("nom_operation", v)}
          options={options.operations}
          required
        />
        <ChampSelect label="Client" value={form.client} onChange={(v) => champ("client", v)} options={options.clients} />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="text-xs font-semibold text-isoGreen uppercase mb-2 col-span-2">
          Production
        </legend>
        <ChampSelect label="État" value={form.etat} onChange={(v) => champ("etat", v)} options={options.etats} required />
        <ChampSelect
          label="Nature production"
          value={form.nature_prod}
          onChange={(v) => champ("nature_prod", v)}
          options={options.naturesProd}
          required
        />
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="text-xs font-semibold text-isoRed uppercase mb-2 col-span-2">
          Retour dossier
        </legend>
        <ChampCase label="Retour interne" checked={form.retour_interne} onChange={(v) => champ("retour_interne", v)} />
        {form.retour_interne && (
          <ChampSelect
            label="Cause retour interne"
            value={form.cause_retour_interne}
            onChange={(v) => champ("cause_retour_interne", v)}
            options={options.causesInterne}
          />
        )}
        <ChampCase label="Retour client" checked={form.retour_client} onChange={(v) => champ("retour_client", v)} />
        {form.retour_client && (
          <>
            <ChampSelect
              label="Cause retour client"
              value={form.cause_retour_client}
              onChange={(v) => champ("cause_retour_client", v)}
              options={options.causesClient}
            />
            <Champ
              label="Date retour client"
              type="date"
              value={form.date_retour_client}
              onChange={(v) => champ("date_retour_client", v)}
            />
            <Champ
              label="Date nouvelle modification"
              type="date"
              value={form.date_nouvelle_modification}
              onChange={(v) => champ("date_nouvelle_modification", v)}
            />
            <ChampSelect
              label="Ingénieur de modif."
              value={form.ingenieur_modif}
              onChange={(v) => champ("ingenieur_modif", v)}
              options={options.ingenieurs}
            />
          </>
        )}
      </fieldset>

      <fieldset className="grid grid-cols-2 gap-4">
        <legend className="text-xs font-semibold text-isoNavy uppercase mb-2 col-span-2">
          Suivi qualité
        </legend>
        <ChampSelect label="Validé par" value={form.valide_par} onChange={(v) => champ("valide_par", v)} options={options.validateurs} />
        <div className="col-span-2">
          <Champ label="Commentaire" value={form.commentaire} onChange={(v) => champ("commentaire", v)} textarea />
        </div>
      </fieldset>

      {erreurValidation && (
        <div className="text-isoRed text-sm font-medium">{erreurValidation}</div>
      )}

      <button type="submit" disabled={envoi || !!erreurValidation} className="btn-primary self-start disabled:opacity-50">
        {envoi ? "Enregistrement…" : "Enregistrer le dossier"}
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

function ChampSelect({ label, value, onChange, options = [], required, disabled }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-ink/50">{label}</label>
      <select
        required={required}
        disabled={disabled}
        className="border rounded-md px-2 py-1.5 text-sm disabled:bg-black/5"
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

function ChampCase({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm mt-5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
