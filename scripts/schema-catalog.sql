-- Read-only application catalogue; no data rows, no function execution.
-- Supabase-managed auth/storage objects are excluded except storage policies and
-- the application's signup trigger. Owners are omitted (migration roles differ).
select jsonb_build_object('kind', kind, 'name', name, 'value', value)::text
from (
  select 'function' as kind,
    n.nspname || '.' || p.proname || '(' || oidvectortypes(p.proargtypes) || ')' as name,
    jsonb_build_object('definition', pg_get_functiondef(p.oid), 'grants',
      (select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        a.privilege_type, a.is_grantable) order by a.grantee=0 desc, pg_get_userbyid(a.grantee), a.privilege_type)
       from aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a where a.grantee<>p.proowner)) as value
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.prokind in ('f','p')
  union all
  select 'relation', n.nspname || '.' || c.relname,
    jsonb_build_object('rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity, 'grants',
      (select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        a.privilege_type, a.is_grantable) order by a.grantee=0 desc, pg_get_userbyid(a.grantee), a.privilege_type)
       from aclexplode(coalesce(c.relacl, acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end, c.relowner))) a
       where a.grantee<>c.relowner))
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p','v','m','S','f')
  union all
  select 'column-grant', n.nspname || '.' || c.relname || '.' || col.attname,
    (select jsonb_agg(jsonb_build_array(case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      a.privilege_type, a.is_grantable) order by a.grantee=0 desc, pg_get_userbyid(a.grantee), a.privilege_type)
     from aclexplode(col.attacl) a where a.grantee<>c.relowner)
  from pg_attribute col join pg_class c on c.oid=col.attrelid join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and col.attnum>0 and not col.attisdropped and col.attacl is not null
  union all
  select 'policy', schemaname || '.' || tablename || '.' || policyname,
    jsonb_build_object('permissive', permissive, 'roles', (select jsonb_agg(r order by r) from unnest(roles) r),
      'cmd', cmd, 'qual', qual, 'with_check', with_check)
  from pg_policies where schemaname in ('public','storage')
  union all
  select 'trigger', n.nspname || '.' || c.relname || '.' || t.tgname,
    jsonb_build_object('definition', pg_get_triggerdef(t.oid), 'enabled', t.tgenabled)
  from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
  where not t.tgisinternal and (n.nspname='public' or
    (n.nspname in ('auth','storage') and t.tgfoid in
      (select p.oid from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public')))
) catalogue order by kind, name;
