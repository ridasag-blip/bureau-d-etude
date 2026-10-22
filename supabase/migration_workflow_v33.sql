-- ============================================================
-- Migration V33 — Date de dernière modification des dossiers
--   · Chaque retour (interne ou client) enregistre maintenant sa date dans dossiers.date_nouvelle_modification :
--     le dossier apparaît (listes, recherche, filtre Date) à la date de sa dernière modification.
--   · Cette migration remplit cette date pour les retours déjà enregistrés (dernier retour non levé).
-- À exécuter UNE fois dans Supabase → SQL Editor → Run (après la V32). Sans risque, peut être relancée.
-- ============================================================

update dossiers d
set date_nouvelle_modification = x.derniere
from (
  select dossier_id, max((created_at at time zone 'Africa/Tunis')::date) as derniere
  from dossier_retours
  where coalesce(annule, false) = false
  group by dossier_id
) x
where x.dossier_id = d.id
  and (d.date_nouvelle_modification is null or d.date_nouvelle_modification < x.derniere);

create index if not exists idx_dossiers_date_modif on dossiers(date_nouvelle_modification);

notify pgrst, 'reload schema';
