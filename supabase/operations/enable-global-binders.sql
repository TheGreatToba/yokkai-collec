-- DO NOT RUN ON PRODUCTION WITHOUT EXPLICIT OWNER AUTHORIZATION.
-- This checksum identifies the reviewed proposal; it does not grant permission.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('global-binders-activation',0));
lock table public.cards,public.card_franchises in share mode;
do $$
begin
  if not exists(select 1 from public.global_binder_settings where singleton
    and manifest_sha256='54c58e1ce36c2eec0c19570d312cd9714e2ccfd4af5190e6e1ba373811570c3e')
    then raise exception 'GLOBAL_BINDER_UNREVIEWED_MANIFEST'; end if;
  if position('delete from public.card_franchises' in lower(pg_get_functiondef('public.normalize_card_franchise_before_write()'::regprocedure)))>0
    then raise exception 'GLOBAL_BINDER_SECONDARY_LICENSE_PREREQUISITE'; end if;
  perform public.validate_global_binder_mapping();
end $$;
update public.global_binder_settings set enabled=true,preferences_global=true where singleton;
select jsonb_build_object('enabled',enabled,'manifest_sha256',manifest_sha256,
  'cards',(select count(*) from public.cards),'source_links',(select count(*) from public.card_franchises),
  'projected_links',(select count(*) from public.global_binder_card_franchises),
  'owned_instances',(select count(*) from public.user_cards),
  'card_wishlists',(select count(*) from public.wishlists),
  'raw_binder_favorites',(select count(*) from public.panini_album_favorites)) as activation_report
from public.global_binder_settings where singleton;
commit;
