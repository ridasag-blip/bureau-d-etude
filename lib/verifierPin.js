/**
 * Vérifie un code personnel côté base (fonction fn_verifier_pin, migration V12).
 * Le code chiffré n'est jamais envoyé au navigateur.
 */
export async function verifierPin(supabase, liste, nom, code) {
  const { data, error } = await supabase.rpc("fn_verifier_pin", { p_liste: liste, p_nom: nom, p_pin: code || "" });
  if (error) {
    throw new Error(
      error.message.includes("fn_verifier_pin")
        ? "Vérification indisponible : exécute supabase/migration_workflow_v12.sql."
        : "Vérification impossible : " + error.message
    );
  }
  return data === true;
}
