"use client";
import { useState } from "react";

export default function SelectionPersonne({ personnes, onSelection, sousTitre = "Qui es-tu ?" }) {
  const [nomChoisi, setNomChoisi] = useState("");
  const [pin, setPin] = useState("");
  const [erreur, setErreur] = useState("");

  function valider(e) {
    e.preventDefault();
    const p = personnes.find((x) => x.nom === nomChoisi);
    if (!p) return setErreur("Choisis ton nom.");
    if ((p.pin || "") !== pin) {
      setErreur("Code incorrect.");
      return;
    }
    onSelection(nomChoisi);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <form onSubmit={valider} className="card p-8 w-full max-w-sm flex flex-col gap-5">
        <div className="flex items-center justify-center gap-2 font-display font-bold text-xl mb-2">
          <img src="/logo-hillsolution.png" alt="Hill Solution" className="h-14 w-auto" />
        </div>
        <p className="text-center text-sm text-ink/50 -mt-3">{sousTitre}</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Ton nom</label>
          <select
            required
            className="border rounded-md px-3 py-2 text-sm"
            value={nomChoisi}
            onChange={(e) => setNomChoisi(e.target.value)}
          >
            <option value="">—</option>
            {personnes.map((p) => (
              <option key={p.nom} value={p.nom}>{p.nom}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Ton code (6 chiffres)</label>
          <input
            type="password"
            inputMode="numeric"
            maxLength={6}
            required
            className="border rounded-md px-3 py-2 text-sm tracking-widest text-center"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>

        {erreur && <p className="text-isoRed text-sm">{erreur}</p>}

        <button type="submit" className="btn-primary">Entrer</button>

        <p className="text-xs text-ink/40 text-center">
          Code oublié ? Demande à un administrateur de le réinitialiser dans Paramètres.
        </p>
      </form>
    </div>
  );
}
