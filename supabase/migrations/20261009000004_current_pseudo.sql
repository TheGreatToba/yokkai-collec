begin;

create function public.get_current_pseudo()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select pseudo from public.user_profiles where user_id = auth.uid();
$$;

-- Supabase defaults grant EXECUTE to service_role too; this RPC is session-only.
revoke all on function public.get_current_pseudo() from public, anon, authenticated, service_role;
grant execute on function public.get_current_pseudo() to authenticated;

commit;
