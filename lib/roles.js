// Compte « Visualisation » (rôle lecteur, migration V36) : voit tout sauf les Paramètres, ne modifie rien.
export const estLecteur = (profile) => profile?.role === "lecteur";
/** Rôles qui consultent les écrans de pilotage (Saisie, Qualité, Dashboard…). */
export const ROLES_PILOTAGE = ["admin", "qualite", "lecteur"];
export const accueilPour = (role) => (role === "ingenieur" ? "/mes-dossiers" : role === "lecteur" ? "/dashboard" : "/saisie");
