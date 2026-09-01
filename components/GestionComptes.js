"use client";
import { useEffect, useState } from "react";

async function appelApi(supabase, methode, corps) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/comptes", {
    method: methode,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: corps ? JSON.stringify(corps) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erreur inconnue");
  return data;
}

export default function GestionComptes({ supabase }) {
  const [comptes, setComptes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [nouveauCompte, setNouveauCompte] = useState({ nomUtilisateur: "", motDePasse: "", nomComplet: "", role: "ingenieur" });

  async function charger() {
    setChargement(true);
    setErreur("");
    try {
      const { comptes } = await appelApi(supabase, "GET");
      setComptes(comptes);
    } catch (e) {
      setErreur(e.message);
    }
    setChargement(false);
  }

  useEffect(() => {
    charger();
  }, []);

  async function creerCompte(e) {
    e.preventDefault();
    setErreur("");
    try {
      await appelApi(supabase, "POST", nouveauCompte);
      setNouveauCompte({ nomUtilisateur: "", motDePasse: "", nomComplet: "", role: "ingenieur" });
      charger();
    } catch (e) {
      setErreur(e.message);
    }
  }

  async function changerMotDePasse(compte) {
    const nouveau = prompt(`Nouveau mot de passe pour ${compte.email} :`);
    if (!nouveau) return;
    try {
      await appelApi(supabase, "PATCH", { id: compte.id, nouveauMotDePasse: nouveau });
      alert("Mot de passe mis à jour.");
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  }

  async function changerRole(compte, nouveauRole) {
    try {
      await appelApi(supabase, "PATCH", { id: compte.id, role: nouveauRole });
      charger();
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  }

  async function supprimerCompte(compte) {
    if (!confirm(`Supprimer définitivement le compte ${compte.email} ? Cette action est irréversible.`)) return;
    try {
      await appelApi(supabase, "DELETE", { id: compte.id });
      charger();
    } catch (e) {
      alert("Erreur : " + e.message);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-4">
        <p className="text-xs font-semibold text-ink/50 uppercase tracking-wide mb-3">Créer un compte</p>
        <form onSubmit={creerCompte} className="grid md:grid-cols-4 gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/50">Nom d'utilisateur</label>
            <input
              required
              className="border rounded-md px-2 py-1.5 text-sm"
              value={nouveauCompte.nomUtilisateur}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, nomUtilisateur: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/50">Mot de passe</label>
            <input
              required
              type="password"
              className="border rounded-md px-2 py-1.5 text-sm"
              value={nouveauCompte.motDePasse}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, motDePasse: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/50">Nom complet</label>
            <input
              className="border rounded-md px-2 py-1.5 text-sm"
              value={nouveauCompte.nomComplet}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, nomComplet: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-ink/50">Rôle</label>
            <select
              className="border rounded-md px-2 py-1.5 text-sm"
              value={nouveauCompte.role}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, role: e.target.value }))}
            >
              <option value="ingenieur">Ingénieur</option>
              <option value="qualite">Qualité</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <button type="submit" className="btn-primary !py-1.5 md:col-span-4 self-start">
            Créer le compte
          </button>
        </form>
        {erreur && <p className="text-isoRed text-sm mt-2">{erreur}</p>}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left text-xs text-ink/50 uppercase bg-black/[0.03]">
              <th className="px-3 py-2 border border-black/10">Email / Nom d'utilisateur</th>
              <th className="px-3 py-2 border border-black/10">Nom complet</th>
              <th className="px-3 py-2 border border-black/10">Rôle</th>
              <th className="px-3 py-2 border border-black/10">Créé le</th>
              <th className="px-3 py-2 border border-black/10"></th>
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => (
              <tr key={c.id} className="border border-black/10">
                <td className="px-3 py-2 border border-black/10 font-medium">{c.email}</td>
                <td className="px-3 py-2 border border-black/10">{c.nom_complet || "—"}</td>
                <td className="px-3 py-2 border border-black/10">
                  <select
                    className="border rounded-md px-2 py-1 text-xs"
                    value={c.role || ""}
                    onChange={(e) => changerRole(c, e.target.value)}
                  >
                    <option value="ingenieur">Ingénieur</option>
                    <option value="qualite">Qualité</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="px-3 py-2 border border-black/10 text-ink/50">
                  {new Date(c.created_at).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-3 py-2 border border-black/10">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => changerMotDePasse(c)} className="btn-secondary !py-1 !px-2 text-xs">
                      Mot de passe
                    </button>
                    <button
                      onClick={() => supprimerCompte(c)}
                      className="btn-secondary !py-1 !px-2 text-xs border-isoRed text-isoRed"
                    >
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!chargement && comptes.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-ink/40 border border-black/10">
                  Aucun compte.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
