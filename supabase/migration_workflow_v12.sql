-- ============================================================
-- Migration V12 — Circuit fiabilisé + sécurité
-- À exécuter UNE fois dans Supabase → SQL Editor → Run (après la V11). Additif :
-- aucune donnée supprimée (les codes PIN en clair sont remplacés par leur version chiffrée).
-- Puis : notify pgrst, 'reload schema';
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- 1. Nouvelles colonnes
-- ------------------------------------------------------------
-- Contrôle renforcé (double contrôle)
alter table dossiers add column if not exists controle_renforce boolean not null default false;
alter table dossiers add column if not exists premier_controle_par text;
alter table dossiers add column if not exists date_premier_controle timestamptz;

-- Demande d'info de l'ingénieur vers la Qualité
alter table dossiers add column if not exists info_type text;
alter table dossiers drop constraint if exists chk_info_type;
alter table dossiers add constraint chk_info_type
  check (info_type is null or info_type in ('dossier_incomplet', 'consigne_manquante', 'info_manquante'));
alter table dossiers add column if not exists info_demandee_le timestamptz;
alter table dossiers add column if not exists info_fournie_le timestamptz;
alter table dossiers add column if not exists info_reponse text;

-- Règles de contrôle renforcé : ingénieur « en formation », fiche « à risque »
alter table parametres_ingenieurs add column if not exists controle_renforce boolean not null default false;
alter table parametres_operations add column if not exists controle_renforce boolean not null default false;

-- Comptes nominatifs : lien compte → validateur (le lien → ingénieur existe déjà : ingenieur_ref)
alter table profiles add column if not exists validateur_ref text;

-- ------------------------------------------------------------
-- 2. Motifs de suspension / pause / annulation (liste gérée dans Paramètres)
-- ------------------------------------------------------------
create table if not exists parametres_motifs_suspension (
  id uuid primary key default gen_random_uuid(),
  libelle text not null unique,
  actif boolean default true
);
insert into parametres_motifs_suspension (libelle)
select v from (values
  ('Bénéficiaire injoignable'),
  ('Pièce justificative manquante'),
  ('Attente retour client'),
  ('Non-conformité technique'),
  ('Doublon'),
  ('Abandon du bénéficiaire')
) as t(v)
on conflict (libelle) do nothing;

-- ------------------------------------------------------------
-- 3. Nouveaux types d'événements
-- ------------------------------------------------------------
alter table dossier_evenements drop constraint if exists dossier_evenements_type_check;
alter table dossier_evenements add constraint dossier_evenements_type_check check (type in (
  'assignation', 'acceptation', 'soumission_verification', 'prise_en_charge', 'verification_ok',
  'retour_interne_avant_audit', 'retour_interne_apres_audit', 'retour_client', 'reassignation',
  'changement_statut_manuel', 'mise_en_file', 'prise_file', 'attente_info', 'reprise',
  'premier_controle', 'info_fournie'
));

-- ------------------------------------------------------------
-- 4. Sécurité des listes de paramètres (RLS) : lecture pour les comptes connectés,
--    écriture réservée à l'admin. Avant : aucune protection sur ces tables.
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'parametres_ingenieurs', 'parametres_validateurs', 'parametres_operations', 'parametres_clients',
    'parametres_nature_production', 'parametres_causes_retour', 'parametres_motifs_suspension'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "%s_lecture" on %I', t, t);
    execute format('create policy "%s_lecture" on %I for select using (auth.uid() is not null)', t, t);
    execute format('drop policy if exists "%s_ecriture" on %I', t, t);
    execute format(
      'create policy "%s_ecriture" on %I for all using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = ''admin''))',
      t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 5. Codes PIN chiffrés, jamais lisibles depuis le navigateur
-- ------------------------------------------------------------
alter table parametres_ingenieurs add column if not exists pin_hash text;
alter table parametres_validateurs add column if not exists pin_hash text;
alter table parametres_ingenieurs add column if not exists pin_defini boolean not null default false;
alter table parametres_validateurs add column if not exists pin_defini boolean not null default false;

update parametres_ingenieurs set pin_hash = crypt(pin, gen_salt('bf')), pin_defini = true, pin = null
  where pin is not null and pin <> '';
update parametres_validateurs set pin_hash = crypt(pin, gen_salt('bf')), pin_defini = true, pin = null
  where pin is not null and pin <> '';

-- Les colonnes pin / pin_hash ne sont plus lisibles par les comptes de l'app
revoke select on parametres_ingenieurs from anon, authenticated;
revoke select on parametres_validateurs from anon, authenticated;
grant select (id, nom, actif, pin_defini, controle_renforce) on parametres_ingenieurs to authenticated;
grant select (id, nom, actif, pin_defini) on parametres_validateurs to authenticated;
grant insert, update on parametres_ingenieurs, parametres_validateurs to authenticated; -- RLS : admin seulement

create or replace function fn_verifier_pin(p_liste text, p_nom text, p_pin text)
returns boolean
language plpgsql security definer set search_path = public, extensions
as $$
declare v_hash text;
begin
  if auth.uid() is null then return false; end if;
  if p_liste = 'ingenieurs' then
    select pin_hash into v_hash from parametres_ingenieurs where nom = p_nom and actif;
  elsif p_liste = 'validateurs' then
    select pin_hash into v_hash from parametres_validateurs where nom = p_nom and actif;
  else
    return false;
  end if;
  if v_hash is null then return coalesce(p_pin, '') = ''; end if; -- pas de code défini
  perform pg_sleep(0.4); -- freine les essais en rafale
  return v_hash = crypt(p_pin, v_hash);
end;
$$;
grant execute on function fn_verifier_pin(text, text, text) to authenticated;

create or replace function fn_definir_pin(p_liste text, p_id uuid, p_pin text)
returns void
language plpgsql security definer set search_path = public, extensions
as $$
declare v_hash text;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'reserve_admin';
  end if;
  v_hash := case when coalesce(p_pin, '') = '' then null else crypt(p_pin, gen_salt('bf')) end;
  if p_liste = 'ingenieurs' then
    update parametres_ingenieurs set pin_hash = v_hash, pin_defini = v_hash is not null, pin = null where id = p_id;
  elsif p_liste = 'validateurs' then
    update parametres_validateurs set pin_hash = v_hash, pin_defini = v_hash is not null, pin = null where id = p_id;
  end if;
end;
$$;
grant execute on function fn_definir_pin(text, uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 6. « Je contrôle » atomique : deux personnes ne peuvent jamais prendre le même dossier
-- ------------------------------------------------------------
create or replace function fn_prendre_controle(p_id uuid, p_nom text)
returns setof dossiers
language plpgsql security definer set search_path = public
as $$
declare v dossiers;
begin
  if not exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin', 'qualite')) then
    raise exception 'reserve_qualite';
  end if;
  select * into v from dossiers where id = p_id for update;
  if v.id is null then raise exception 'introuvable'; end if;
  if v.etat = 'En cours de vérification' then raise exception 'deja_pris:%', coalesce(v.pris_en_charge_par, '?'); end if;
  if v.etat <> 'En attente de vérification' then raise exception 'plus_a_controler'; end if;
  if v.controle_renforce and v.premier_controle_par is not null and v.premier_controle_par = p_nom then
    raise exception 'meme_controleur';
  end if;

  update dossiers set etat = 'En cours de vérification', pris_en_charge_par = p_nom, date_prise_en_charge = now()
  where id = p_id;
  insert into dossier_evenements (dossier_id, type, effectue_par, effectue_par_nom)
  values (p_id, 'prise_en_charge', auth.uid(), p_nom);
  return query select * from dossiers where id = p_id;
end;
$$;
grant execute on function fn_prendre_controle(uuid, text) to authenticated;

-- ------------------------------------------------------------
-- 7. Validation : uniquement depuis « En vérification Q », par la personne qui contrôle.
--    Contrôle renforcé : 1er contrôle → le dossier repasse « À contrôler » pour un 2e contrôleur.
--    Renvoie 'valide' ou 'premier_controle'.
-- ------------------------------------------------------------
create or replace function fn_valider(p_id uuid, p_nom text, p_valide_par text)
returns text
language plpgsql security definer set search_path = public
as $$
declare v dossiers; v_admin boolean;
begin
  select (p.role = 'admin') into v_admin from profiles p where p.id = auth.uid() and p.role in ('admin', 'qualite');
  if v_admin is null then raise exception 'reserve_qualite'; end if;

  select * into v from dossiers where id = p_id for update;
  if v.etat <> 'En cours de vérification' then raise exception 'pas_en_controle'; end if;
  if not v_admin and coalesce(v.pris_en_charge_par, '') <> p_nom then raise exception 'autre_controleur'; end if;

  if v.controle_renforce and v.premier_controle_par is null then
    update dossiers set
      premier_controle_par = p_valide_par, date_premier_controle = now(),
      etat = 'En attente de vérification', pris_en_charge_par = null, date_prise_en_charge = null
    where id = p_id;
    insert into dossier_evenements (dossier_id, type, effectue_par, effectue_par_nom, cause)
    values (p_id, 'premier_controle', auth.uid(), p_nom, '2e contrôleur requis');
    return 'premier_controle';
  end if;

  if v.controle_renforce and v.premier_controle_par = p_valide_par then raise exception 'meme_controleur'; end if;

  update dossiers set etat = 'Audité', date_verification = now(), valide_par = p_valide_par, a_corriger = false
  where id = p_id;
  insert into dossier_evenements (dossier_id, type, effectue_par, effectue_par_nom)
  values (p_id, 'verification_ok', auth.uid(), p_nom);
  return 'valide';
end;
$$;
grant execute on function fn_valider(uuid, text, text) to authenticated;

-- ------------------------------------------------------------
-- 8. Contrôle renforcé posé automatiquement à l'envoi au contrôle :
--    dossier revenu 2 fois ou plus, ingénieur en formation, ou fiche à risque.
-- ------------------------------------------------------------
create or replace function fn_regle_controle_renforce()
returns trigger language plpgsql as $$
begin
  if new.etat = 'En attente de vérification' and old.etat is distinct from new.etat
     and old.etat not in ('En cours de vérification') then
    new.premier_controle_par := null;
    new.date_premier_controle := null;
    new.controle_renforce := coalesce(new.nb_retours, 0) >= 2
      or exists (select 1 from parametres_ingenieurs i where i.nom = new.ingenieur and i.controle_renforce)
      or exists (select 1 from parametres_operations o where o.libelle = new.nom_operation and o.controle_renforce);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_regle_controle_renforce on dossiers;
create trigger trg_regle_controle_renforce before update on dossiers
  for each row execute function fn_regle_controle_renforce();

notify pgrst, 'reload schema';
