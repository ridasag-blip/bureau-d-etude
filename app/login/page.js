"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [erreur, setErreur] = useState("");
  const [chargement, setChargement] = useState(false);
  const router = useRouter();

  async function seConnecter(e) {
    e.preventDefault();
    setErreur("");
    setChargement(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: motDePasse,
    });
    setChargement(false);
    if (error) {
      setErreur("Identifiants incorrects. Vérifie ton email et ton mot de passe.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <form onSubmit={seConnecter} className="card p-8 w-full max-w-sm flex flex-col gap-5">
        <div className="flex items-center gap-2 font-display font-bold text-xl justify-center mb-2">
          <span className="w-3 h-7 bg-isoGreen rounded-sm" />
          <span className="w-3 h-7 bg-isoRed rounded-sm -ml-1.5" />
          <span className="ml-2">ISO BAT</span>
        </div>
        <p className="text-center text-sm text-ink/50 -mt-3">Suivi Qualité — Bureau d'étude</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-ink/50">Email</label>
          <input
            type="email"
            required
            className="border rounded-md px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
