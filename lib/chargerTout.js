/**
 * Charge toutes les lignes d'une requête, par pages de 1000.
 * Supabase plafonne chaque réponse à 1000 lignes : un simple .limit(10000)
 * renvoyait donc au plus 1000 dossiers, et les statistiques étaient faussées
 * dès que la base dépassait ce volume.
 *
 * @param construire () => requête Supabase (sans .range ni .limit), ex. () => supabase.from("dossiers").select("*").order("date")
 */
export async function chargerTout(construire, { taille = 1000, max = 50000 } = {}) {
  const lignes = [];
  for (let debut = 0; debut < max; debut += taille) {
    const { data, error } = await construire().range(debut, debut + taille - 1);
    if (error) return { data: lignes.length ? lignes : null, error };
    lignes.push(...(data || []));
    if (!data || data.length < taille) break;
  }
  return { data: lignes, error: null };
}
