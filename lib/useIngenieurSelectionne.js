"use client";
import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "hillsolution_ingenieur_selectionne";

/**
 * Gère la sélection "Qui es-tu ?" pour le compte ingénieur partagé.
 * Le nom choisi (vérifié par PIN) est mémorisé sur cet appareil (localStorage),
 * pas lié au compte Supabase Auth qui reste unique/partagé pour tous les ingénieurs.
 */
export function useIngenieurSelectionne() {
  const [nom, setNom] = useState(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    const stocke = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    setNom(stocke || null);
    setPret(true);
  }, []);

  const selectionner = useCallback((nomChoisi) => {
    window.localStorage.setItem(STORAGE_KEY, nomChoisi);
    setNom(nomChoisi);
  }, []);

  const changerDePersonne = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setNom(null);
  }, []);

  return { nom, pret, selectionner, changerDePersonne };
}
