"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/**
 * Charge le profil connecté + toutes les listes de référence (Paramètres).
 * Redirige vers /login si non authentifié.
 *
 * NB: toutes les tables de cette app sont préfixées "" dans Supabase
 * pour ne pas entrer en collision avec les tables de ton CRM (même projet).
 */
export function useAppData() {
  const supabase = createClient();
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [erreurProfil, setErreurProfil] = useState(null);
  const [options, setOptions] = useState({
    ingenieurs: [],
    operations: [],
    clients: [],
    etats: [],
    naturesProd: [],
    causesInterne: [],
    causesClient: [],
    validateurs: [],
  });
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data: prof, error: profError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profError || !prof) {
      setErreurProfil(
        "Ton compte est connecté mais n'a pas encore de profil configuré. " +
          "Demande à un administrateur d'ajouter une ligne dans la table « profiles » " +
          "avec ton identifiant : " + user.id
      );
      setLoading(false);
      return;
    }
    setProfile(prof);

    const [ing, ope, cli, eta, nat, causes, val] = await Promise.all([
      supabase.from("parametres_ingenieurs").select("nom").eq("actif", true).order("nom"),
      supabase.from("parametres_operations").select("libelle").eq("actif", true).order("libelle"),
      supabase.from("parametres_clients").select("nom").eq("actif", true).order("nom"),
      supabase.from("parametres_etats").select("libelle").eq("actif", true).order("ordre"),
      supabase.from("parametres_nature_production").select("libelle").eq("actif", true),
      supabase.from("parametres_causes_retour").select("libelle,type").eq("actif", true),
      supabase.from("parametres_validateurs").select("nom").eq("actif", true).order("nom"),
    ]);

    setOptions({
      ingenieurs: (ing.data || []).map((r) => r.nom),
      operations: (ope.data || []).map((r) => r.libelle),
      clients: (cli.data || []).map((r) => r.nom),
      etats: (eta.data || []).map((r) => r.libelle),
      naturesProd: (nat.data || []).map((r) => r.libelle),
      causesInterne: (causes.data || [])
        .filter((c) => c.type === "interne" || c.type === "generique")
        .map((c) => c.libelle),
      causesClient: (causes.data || [])
        .filter((c) => c.type === "client" || c.type === "generique")
        .map((c) => c.libelle),
      validateurs: (val.data || []).map((r) => r.nom),
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  return { profile, erreurProfil, options, loading, refresh: charger, supabase };
}

/** Applique les filtres communs (mois/année/opération/client/ingénieur/dates) à une liste de dossiers */
export function appliquerFiltres(dossiers, filtres) {
  return dossiers.filter((d) => {
    if (filtres.operation !== "Tous" && d.nom_operation !== filtres.operation) return false;
    if (filtres.client !== "Tous" && d.client !== filtres.client) return false;
    if (filtres.ingenieur !== "Tous" && d.ingenieur !== filtres.ingenieur) return false;
    if (filtres.du && d.date < filtres.du) return false;
    if (filtres.au && d.date > filtres.au) return false;
    if (filtres.annee !== "Tous" && new Date(d.date).getFullYear() !== Number(filtres.annee))
      return false;
    if (filtres.mois !== "Tous") {
      const MOIS = [
        "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
        "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
      ];
      if (MOIS[new Date(d.date).getMonth()] !== filtres.mois) return false;
    }
    return true;
  });
}

export const FILTRES_INITIAUX = {
  mois: "Tous",
  annee: "Tous",
  operation: "Tous",
  client: "Tous",
  ingenieur: "Tous",
  du: "",
  au: "",
};
