"use client";
import { useMemo, useState } from "react";
import Icon from "@/components/ui/Icon";

const initial = {
  date: new Date().toISOString().slice(0, 10),
  nom_dossier: "",
  ingenieur: "",
  nom_operation: "",
  client: "",
  nature_prod: "",
  commentaire: "",
};

/**
 * Formulaire de dispatching. Rendu « nu » (sans carte) : il est affiché dans une Modal.
 * Le bouton d'envoi est dans le formulaire (id="form-saisie") pour rester accessible au clavier.
 */
export default function DossierFormSaisie({ options, dossiersExistants, chargeParIngenieur, onSubmit, roleActuel, ingenieurConnecte, onAnnuler }) {
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
    <form onSubmit={envoyer} className="flex flex-col gap-5">
      <p className="alert alert-info">
        <Icon name="send" size={15} className="mt-0.5" />
        <span>Assigne un dossier à un ingénieur. Le retour qualité se fait ensuite dans la page « Qualité ».</span>
      </p>

      {doublonPotentiel && (
        <div className="alert alert-gold" role="alert">
          <Icon name="alert" size={16} className="mt-0.5" />
          <span>
            Un dossier nommé « <strong>{doublonPotentiel.nom_dossier}</strong> » existe déjà (saisi le{" "}
            {doublonPotentiel.date}, par {doublonPotentiel.ingenieur}). Vérifie qu'il ne s'agit pas d'un doublon avant
            d'enregistrer.
          </span>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <Champ label="Nom dossier" value={form.nom_dossier} onChange={(v) => champ("nom_dossier", v)} required autoFocus />
        <Champ label="Date" type="date" value={form.date} onChange={(v) => champ("date", v)} required />

        <div className="field">
          <label className="label">
            Ingénieur <span className="text-isoRed">*</span>
          </label>
          <select
            required
            disabled={roleActuel === "ingenieur"}
            className="input"
            value={form.ingenieur}
            onChange={(e) => champ("ingenieur", e.target.value)}
          >
            <option value="">Choisir…</option>
            {options.ingenieurs?.map((o) => (
              <option key={o} value={o}>
                {o} {chargeParIngenieur?.[o] ? `— ${chargeParIngenieur[o]} en cours` : "— disponible"}
              </option>
            ))}
          </select>
        </div>

        <ChampSelect
          label="Opération"
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
        <div className="sm:col-span-2">
          <Champ label="Commentaire (optionnel)" value={form.commentaire} onChange={(v) => champ("commentaire", v)} textarea />
        </div>
      </div>

      <div className="flex justify-end gap-2 border-t border-line -mx-6 px-6 pt-4">
        {onAnnuler && (
          <button type="button" onClick={onAnnuler} className="btn-secondary">
            Annuler
          </button>
        )}
        <button type="submit" disabled={envoi} className="btn-primary">
          <Icon name="plus" size={16} />
          {envoi ? "Enregistrement…" : "Créer le dossier"}
        </button>
      </div>
    </form>
  );
}

function Champ({ label, value, onChange, type = "text", required, textarea, autoFocus }) {
  return (
    <div className="field">
      <label className="label">
        {label} {required && <span className="text-isoRed">*</span>}
      </label>
      {textarea ? (
        <textarea className="input" rows={3} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input
          type={type}
          required={required}
          autoFocus={autoFocus}
          className="input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

function ChampSelect({ label, value, onChange, options = [], required }) {
  return (
    <div className="field">
      <label className="label">
        {label} {required && <span className="text-isoRed">*</span>}
      </label>
      <select required={required} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choisir…</option>
        {options?.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}
