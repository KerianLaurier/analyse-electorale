-- Durcissement (défense en profondeur) : l'application n'effectue AUCUN accès
-- anonyme à Postgres — les écrans publics (landing, auth) ne lisent pas la
-- base, et tout accès données passe par le rôle `authenticated`. Le rôle
-- `anon` conservait pourtant les privilèges par défaut Supabase (SELECT,
-- INSERT, UPDATE, DELETE, TRUNCATE…) sur les 16 tables du schéma public.
-- La RLS bloque l'exploitation aujourd'hui (toutes les policies exigent
-- auth.uid()), mais une policy permissive ajoutée par erreur exposerait tout.
--
-- ⚠️ À appliquer manuellement (migration prod soumise à validation).

revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- Les fonctions RPC restent réservées aux comptes connectés.
revoke execute on all functions in schema public from anon;
alter default privileges in schema public revoke execute on functions from anon;
