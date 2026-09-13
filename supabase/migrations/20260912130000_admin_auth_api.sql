-- L'API Auth officielle remplace l'insertion directe dans les tables internes.
revoke execute on function public.admin_create_account(text,text,text,text,text,text,timestamptz,boolean) from public,anon,authenticated,service_role;
