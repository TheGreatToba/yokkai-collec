-- Presentation rollback. Retain the source-backed preference compatibility shim
-- so choices made after activation are not overwritten by a historical snapshot.
begin;
set local lock_timeout='5s';
select pg_advisory_xact_lock(hashtextextended('global-binders-activation',0));
update public.global_binder_settings set enabled=false where singleton;
-- No DELETE, UPDATE or restore of cards, links, collections or preferences.
select enabled,preferences_global,manifest_sha256 from public.global_binder_settings where singleton;
commit;
