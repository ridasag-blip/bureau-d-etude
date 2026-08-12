"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

// Suffixe technique invisible : l'utilisateur tape juste un nom d'utilisateur,
// jamais un email — Supabase authentifie par email en interne uniquement.
const DOMAINE_TECHNIQUE = "@hillsolution.local";

export default function LoginPage() {
  const [nomUtilisateur, setNomUtilisateur] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const router = useRouter();

  async function seConnecter(e) {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const supabase = createClient();
    const saisie = nomUtilisateur.trim().toLowerCase();
    // Si la personne tape une adresse email complète (avec @), on l'utilise telle
    // quelle ; sinon on ajoute le suffixe technique interne pour les comptes partagés.
    const email = saisie.includes("@") ? saisie : saisie + DOMAINE_TECHNIQUE;
    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });
    if (error) {
      setChargement(false);
      setErreur("Identifiants incorrects. Vérifie ton nom d'utilisateur et ton mot de passe.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    setChargement(false);
    router.push(profile?.role === "ingenieur" ? "/mes-dossiers" : "/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <form onSubmit={seConnecter} className="card p-8 w-full max-w-sm flex flex-col gap-5">
        <div className="flex items-center justify-center gap-2 font-display font-bold text-xl mb-2">
          <img src="/logo-hillsolution.png" alt="Hill Solution" className="h-14 w-auto" />
        </div>
        <p className="text-center text-sm text-ink/50 -mt-3">Suivi Qualité — Bureau d'Études</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Nom d'utilisateur</label>
          <input
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            required
            className="border rounded-md px-3 py-2 text-sm"
            value={nomUtilisateur}
            onChange={(e) => setNomUtilisateur(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Mot de passe</label>
          <input
            type="password"
            required
            className="border rounded-md px-3 py-2 text-sm"
            value={motDePasse}
            onChange={(e) => setMotDePasse(e.target.value)}
          />
        </div>

        {erreur && <p className="text-isoRed text-sm">{erreur}</p>}

        <button type="submit" disabled={chargement} className="btn-primary disabled:opacity-50">
          {chargement ? "Connexion…" : "Se connecter"}
        </button>
      </form>
    </div>
  );
}

