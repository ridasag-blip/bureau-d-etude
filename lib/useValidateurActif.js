"use client";
import { useEffect, useState } from "react";
import { useValidateurSelectionne } from "@/lib/useNomSelectionne";
import { verifierPin } from "@/lib/verifierPin";

/**
 * Pour Admin/Qualité : gère la sélection "Qui es-tu ?" (nom + PIN, liste des
 * validateurs) sur les pages partagées (Dashboard, Saisie, Qualité,
 * Statistiques, Export, Rapport). Paramètres n'utilise pas ce hook — l'accès
 * y est déjà filtré par rôle, pas besoin d'identifier la personne précise.
 */
export function useValidateurActif(profile, supabase) {
  const selection = useValidateurSelectionne();
  // Compte nominatif : le validateur est lié au compte (Paramètres → Comptes), pas de choix ni de code
  const nomCompte = profile?.role === "qualite" ? profile?.validateur_ref || null : null;
  const nom = nomCompte || selection.nom;
  const pret = nomCompte ? true : selection.pret;
  const { selectionner } = selection;
  const changerDePersonne = nomCompte ? undefined : selection.changerDePersonne;
  const verifier = (n, code) => verifierPin(supabase, "validateurs", n, code);
  const [validateurs, setValidateurs] = useState([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from("parametres_validateurs")
        .select("nom")
        .eq("actif", true)
        .order("nom");
      setValidateurs(data || []);
    })();
  }, [profile]);

  return { nom, pret, selectionner, changerDePersonne, validateurs, verifier };
}
