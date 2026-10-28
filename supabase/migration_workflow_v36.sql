-- ============================================================
-- Migration V36 — Compte « Visualisation » (lecture seule)
--   · Nouveau rôle « lecteur » : voit tout (dossiers, historique, statistiques, factures, bénéficiaires…)
--     sauf les Paramètres. Il ne peut RIEN créer, modifier ni supprimer : la base le refuse,
--     même si un bouton restait affiché.
--   · La messagerie lui est fermée (page vide) et il n'apparaît pas dans l'annuaire.
-- À exécuter UNE fois dans Supabase → SQL Editor → Run (après la V35). Additif.
-- ============================================================

-- 1. Nouveau rôle
alter type user_role add value if not exists 'lecteur';

-- 2. « Suis-je un compte Visualisation ? » (security definer : pas de boucle sur la table profiles)
create or replace function fn_est_lecteur()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role::text = 'lecteur');
$$;
grant execute on function fn_est_lecteur() to authenticated;

-- 3. Lecture de toutes les tables de travail, écriture refusée partout
do $$
declare
  t text;
  exclues text[] := array['comptes_mots_de_passe', 'audit_log', 'backups', 'profiles'];
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and rowsecurity
  loop
    -- écriture interdite (politiques « restrictives » : elles s'ajoutent à toutes les autres)
    execute format('drop policy if exists "v36_lecteur_pas_ajout" on %I', t);
    execute format('drop policy if exists "v36_lecteur_pas_modif" on %I', t);
    execute format('drop policy if exists "v36_lecteur_pas_suppr" on %I', t);
    execute format('create policy "v36_lecteur_pas_ajout" on %I as restrictive for insert to authenticated with check (not fn_est_lecteur())', t);
    execute format('create policy "v36_lecteur_pas_modif" on %I as restrictive for update to authenticated using (not fn_est_lecteur())', t);
    execute format('create policy "v36_lecteur_pas_suppr" on %I as restrictive for delete to authenticated using (not fn_est_lecteur())', t);

    -- lecture (sauf tables sensibles et messagerie)
    execute format('drop policy if exists "v36_lecteur_lecture" on %I', t);
    if not (t = any(exclues)) and t not like 'chat\_%' and t not like 'msg\_%' then
      execute format('create policy "v36_lecteur_lecture" on %I for select to authenticated using (fn_est_lecteur())', t);
    end if;
  end loop;
end $$;

-- 4. Fichiers des dossiers : consultation seulement
drop policy if exists "v36_lecteur_fichiers_ajout" on storage.objects;
create policy "v36_lecteur_fichiers_ajout" on storage.objects as restrictive for insert to authenticated
  with check (bucket_id <> 'dossiers-fichiers' or not public.fn_est_lecteur());
drop policy if exists "v36_lecteur_fichiers_modif" on storage.objects;
create policy "v36_lecteur_fichiers_modif" on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'dossiers-fichiers' or not public.fn_est_lecteur());
drop policy if exists "v36_lecteur_fichiers_suppr" on storage.objects;
create policy "v36_lecteur_fichiers_suppr" on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'dossiers-fichiers' or not public.fn_est_lecteur());

-- 5. Connexions des ingénieurs visibles (Production en ce moment, Saisie)
create or replace function fn_presence_ingenieurs()
returns table (ingenieur text, derniere_activite timestamptz, presence_active boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(p.ingenieur_ref, p.nom_complet), p.derniere_activite, p.presence_active
  from profiles p
  where exists (select 1 from profiles moi where moi.id = auth.uid() and moi.role::text in ('admin', 'qualite', 'lecteur'))
    and (p.role = 'ingenieur' or (p.role = 'qualite' and p.traite_dossiers));
$$;
grant execute on function fn_presence_ingenieurs() to authenticated;

-- 6. Annuaire de la messagerie : les comptes Visualisation n'y apparaissent pas
create or replace function fn_chat_annuaire()
returns table (id uuid, nom text, role text, fonction text, derniere_activite timestamptz, presence_active boolean, equipes text[], occupe boolean)
language sql stable security definer set search_path = public as $$
  select p.id, coalesce(nullif(p.nom_complet, ''), 'Sans nom'), p.role::text, p.fonction, p.derniere_activite, p.presence_active,
         coalesce((select array_agg(e.nom order by e.nom) from msg_equipe_membres m join msg_equipes e on e.id = m.equipe_id where m.user_id = p.id), '{}'),
         p.role = 'ingenieur' and exists (select 1 from dossiers d where lower(d.ingenieur) = lower(p.ingenieur_ref) and d.etat = 'Encours')
  from profiles p
  join auth.users u on u.id = p.id
  where exists (select 1 from profiles moi where moi.id = auth.uid() and moi.role::text <> 'lecteur')
    and p.chat_actif
    and p.role::text <> 'lecteur'
    and (u.banned_until is null or u.banned_until < now())
    and not (p.role = 'admin' and coalesce(p.fonction, '') <> 'Responsable')
    and fn_msg_voit(p.id)
  order by 2;
$$;
grant execute on function fn_chat_annuaire() to authenticated;

-- 7. « Prendre le suivant » refusé à un compte Visualisation (même fonction que la V29, avec ce contrôle en plus)
create or replace function fn_prendre_suivant(p_ingenieur text)
returns setof dossiers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_moi text := lower(trim(p_ingenieur));
begin
  if not exists (select 1 from profiles p where p.id = auth.uid()) then
    raise exception 'non_authentifie';
  end if;
  if fn_est_lecteur() then
    raise exception 'lecture_seule';
  end if;

  -- Le dossier appartient à celui qui doit le traiter : l'ingénieur de modif s'il y en a un, sinon l'ingénieur
  if exists (
    select 1 from dossiers
    where lower(trim(coalesce(nullif(ingenieur_modif, ''), ingenieur))) = v_moi and etat = 'Encours'
  ) then
    raise exception 'deja_en_cours';
  end if;

  select id into v_id
  from dossiers
  where lower(trim(coalesce(nullif(ingenieur_modif, ''), ingenieur))) = v_moi
    and etat = 'En attente de traitement'
  order by a_corriger desc, prioritaire desc, coalesce(date_assignation, created_at) asc
  limit 1
  for update skip locked;

  -- Distribution manuelle : l'ingénieur ne prend pas lui-même dans la file d'attente
  if v_id is null and coalesce((select file_mode from parametres_config order by id limit 1), 'auto') = 'manuel' then
    return;
  end if;

  if v_id is null then
    select d.id into v_id
    from dossiers d
    where d.etat = 'Dans la file'
      and d.nom_operation is not null
      and d.client in (select e.client from equipes_clients e where lower(e.ingenieur) = v_moi)
    order by d.prioritaire desc, coalesce(d.date_mise_en_file, d.created_at) asc
    limit 1
    for update skip locked;
  end if;

  if v_id is null then
    select d.id into v_id
    from dossiers d
    where d.etat = 'Dans la file'
      and d.nom_operation in (select h.operation from ingenieur_habilitations h where lower(h.ingenieur) = v_moi)
      and (d.client is null or d.client not in (select e.client from equipes_clients e))
    order by d.prioritaire desc, coalesce(d.date_mise_en_file, d.created_at) asc
    limit 1
    for update skip locked;
  end if;

  if v_id is null then
    return;
  end if;

  update dossiers
  set etat = 'Encours',
      ingenieur = coalesce(ingenieur, p_ingenieur),
      date_acceptation = now(),
      temps_traitement_s = 0,
      date_assignation = coalesce(date_assignation, now())
  where id = v_id;

  insert into dossier_evenements (dossier_id, type, effectue_par, effectue_par_nom)
  values (v_id, 'prise_file', auth.uid(), p_ingenieur);

  return query select * from dossiers where id = v_id;
end;
$$;
grant execute on function fn_prendre_suivant(text) to authenticated;

notify pgrst, 'reload schema';
