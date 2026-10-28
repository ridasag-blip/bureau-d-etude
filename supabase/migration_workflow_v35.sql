-- ============================================================
-- Migration V35 — Dossiers en plusieurs versions (V1, V2…)
--   · dossiers.nb_versions : nombre de versions d'un dossier saisi sur une seule ligne (1 par défaut).
--     Renseigné à la Saisie / à l'import (colonne « Versions ») et modifiable par l'ingénieur et la Qualité.
--   · Les dossiers déjà saisis en deux lignes « …-v1 » / « …-v2 » sont reconnus par l'application,
--     sans modification des données.
--   · Un dossier en plusieurs versions compte pour 1 dossier (facturation, statistiques) ;
--     son délai de traitement est multiplié par le nombre de versions.
-- À exécuter UNE fois dans Supabase → SQL Editor → Run (après la V34). Additif.
-- ============================================================

alter table dossiers add column if not exists nb_versions integer not null default 1;
alter table dossiers drop constraint if exists dossiers_nb_versions_check;
alter table dossiers add constraint dossiers_nb_versions_check check (nb_versions between 1 and 20);

notify pgrst, 'reload schema';
