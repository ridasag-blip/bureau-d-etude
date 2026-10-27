-- ============================================================
-- Migration V34 — Un compte Qualité peut aussi traiter des dossiers
--   · profiles.traite_dossiers : case « Peut aussi traiter des dossiers » (Paramètres → Comptes)
--   · La personne apparaît dans les listes d'attribution (Saisie, file, « Réassigner à »),
--     peut « Prendre le suivant » selon ses habilitations, et sa connexion est visible comme celle d'un ingénieur.
--   · Elle garde ses droits Qualité (elle peut aussi auditer ses propres dossiers).
-- À exécuter UNE fois dans Supabase → SQL Editor → Run (après la V33). Additif.
-- ============================================================

alter table profiles add column if not exists traite_dossiers boolean not null default false;

-- Les comptes Qualité qui traitent des dossiers ne sont plus retirés des listes d'attribution
create or replace function fn_noms_non_assignables()
returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct lower(trim(n))), '{}')
  from (
    select v.nom as n from parametres_validateurs v
    where v.actif
      and not exists (
        select 1 from profiles p
        where p.traite_dossiers and lower(trim(coalesce(p.ingenieur_ref, p.nom_complet, ''))) = lower(trim(v.nom))
      )
    union all
    select nom_complet from profiles
    where role in ('qualite', 'admin') and coalesce(nom_complet, '') <> '' and not traite_dossiers
  ) x
  where exists (select 1 from profiles moi where moi.id = auth.uid());
$$;
grant execute on function fn_noms_non_assignables() to authenticated;

-- Connexion visible dans la Saisie / Production en ce moment, comme pour un ingénieur
create or replace function fn_presence_ingenieurs()
returns table (ingenieur text, derniere_activite timestamptz, presence_active boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(p.ingenieur_ref, p.nom_complet), p.derniere_activite, p.presence_active
  from profiles p
  where exists (select 1 from profiles moi where moi.id = auth.uid() and moi.role in ('admin', 'qualite'))
    and (p.role = 'ingenieur' or (p.role = 'qualite' and p.traite_dossiers));
$$;
grant execute on function fn_presence_ingenieurs() to authenticated;

-- Livrables : la personne Qualité peut supprimer ses livrables comme un ingénieur
-- (le service Qualité a déjà les droits d'écriture sur les dossiers et les fichiers)

notify pgrst, 'reload schema';
