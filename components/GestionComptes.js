"use client";
import { useEffect, useState } from "react";
import Icon from "@/components/ui/Icon";
import Avatar from "@/components/ui/Avatar";

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

export default function GestionComptes({ supabase, ingenieurs = [], validateurs = [] }) {
  const [comptes, setComptes] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState("");
  const [nouveauCompte, setNouveauCompte] = useState({ nomUtilisateur: "", motDePasse: "", nomComplet: "", role: "ingenieur", lien: "" });
  const nomsPour = (role) => (role === "ingenieur" ? ingenieurs : validateurs);

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
      setNouveauCompte({ nomUtilisateur: "", motDePasse: "", nomComplet: "", role: "ingenieur", lien: "" });
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

  async function changerLien(compte, lien) {
    try {
      await appelApi(supabase, "PATCH", { id: compte.id, lien });
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
      <div className="card p-5">
        <p className="card-title mb-4">
          <Icon name="plus" size={15} className="text-ink/40" />
          Créer un compte
        </p>
        <p className="text-sm text-ink/60 mb-4 -mt-2">
          Un compte par personne : relie chaque compte à son nom (ingénieur ou validateur). La personne n'a plus à choisir son nom
          ni à taper de code, et l'historique enregistre qui a vraiment fait chaque action.
        </p>
        <form onSubmit={creerCompte} className="grid sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_150px_170px_auto] gap-3 items-end">
          <div className="field">
            <label className="label">Nom d'utilisateur</label>
            <input
              required
              className="input"
              placeholder="ex. qualite"
              value={nouveauCompte.nomUtilisateur}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, nomUtilisateur: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="label">Mot de passe</label>
            <input
              required
              type="password"
              className="input"
              value={nouveauCompte.motDePasse}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, motDePasse: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="label">Nom complet</label>
            <input
              className="input"
              value={nouveauCompte.nomComplet}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, nomComplet: e.target.value }))}
            />
          </div>
          <div className="field">
            <label className="label">Rôle</label>
            <select
              className="input"
              value={nouveauCompte.role}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, role: e.target.value, lien: "" }))}
            >
              <option value="ingenieur">Ingénieur</option>
              <option value="qualite">Qualité</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="field">
            <label className="label">{nouveauCompte.role === "ingenieur" ? "Ingénieur" : "Validateur"}</label>
            <select
              className="input"
              value={nouveauCompte.lien}
              onChange={(e) => setNouveauCompte((c) => ({ ...c, lien: e.target.value }))}
            >
              <option value="">Compte partagé</option>
              {nomsPour(nouveauCompte.role).map((n) => (
                <option key={n} value={n} className="capitalize">{n}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <Icon name="plus" size={15} />
            Créer
          </button>
        </form>
        {erreur && (
          <div className="alert alert-red mt-3">
            <Icon name="alert" size={16} className="mt-0.5" />
            <span>{erreur}</span>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="table table-hover">
          <thead>
            <tr>
              <th>Nom d'utilisateur</th>
              <th>Nom complet</th>
              <th>Rôle</th>
              <th>Personne</th>
              <th>Créé le</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {comptes.map((c) => (
              <tr key={c.id}>
                <td className="font-semibold">
                  <span className="flex items-center gap-2">
                    <Avatar nom={c.nom_complet || c.email} taille={26} />
                    {c.email?.replace("@hillsolution.local", "")}
                  </span>
                </td>
                <td>{c.nom_complet || "—"}</td>
                <td>
                  <select
                    className="input input-sm w-32"
                    value={c.role || ""}
                    onChange={(e) => changerRole(c, e.target.value)}
                  >
                    <option value="ingenieur">Ingénieur</option>
                    <option value="qualite">Qualité</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td>
                  <select
                    className={`input input-sm w-40 capitalize ${(c.role === "ingenieur" ? c.ingenieur_ref : c.validateur_ref) ? "" : "text-ink/45"}`}
                    value={(c.role === "ingenieur" ? c.ingenieur_ref : c.validateur_ref) || ""}
                    onChange={(e) => changerLien(c, e.target.value)}
                    title="Personne à laquelle ce compte appartient"
                  >
                    <option value="">Compte partagé</option>
                    {nomsPour(c.role).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </td>
                <td className="text-ink/55 tabular">{new Date(c.created_at).toLocaleDateString("fr-FR")}</td>
                <td>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => changerMotDePasse(c)} className="btn-secondary btn-xs">
                      <Icon name="lock" size={13} />
                      Mot de passe
                    </button>
                    <button onClick={() => supprimerCompte(c)} className="btn-danger btn-xs">
                      Supprimer
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {!chargement && comptes.length === 0 && (
              <tr>
                <td colSpan={6} className="table-empty">Aucun compte.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
