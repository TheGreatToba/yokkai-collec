begin;

create function public.get_current_pseudo()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  -- Reuse the existing session-scoped reader, exposing only its pseudo.
  select case when auth.uid() is null then null
    else public.get_game_info()->'user'->>'name' end;
$$;

-- Supabase defaults grant EXECUTE to service_role too; this RPC is session-only.
revoke all on function public.get_current_pseudo() from public, anon, authenticated, service_role;
grant execute on function public.get_current_pseudo() to authenticated;

commit;
