begin;

-- Presentation only. Sources and player preferences are never migrated in place.
create table public.global_binder_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  preferences_global boolean not null default false,
  check (not enabled or preferences_global),
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$')
);
create table public.global_binder_aliases (
  category text not null,
  source_license text not null unique,
  binder_license text not null check (btrim(binder_license) <> '' and char_length(binder_license) <= 200),
  evidence text not null check (btrim(evidence) <> ''),
  primary key (category, source_license),
  check (source_license <> binder_license and btrim(source_license) <> '')
);
create index global_binder_aliases_target_idx on public.global_binder_aliases(binder_license);
alter table public.global_binder_settings enable row level security;
alter table public.global_binder_aliases enable row level security;
revoke all on public.global_binder_settings, public.global_binder_aliases from public, anon, authenticated;
grant select on public.global_binder_settings, public.global_binder_aliases to anon, authenticated;
grant all on public.global_binder_settings, public.global_binder_aliases to service_role;
create policy global_binder_settings_read on public.global_binder_settings for select to anon, authenticated using (true);
create policy global_binder_aliases_read on public.global_binder_aliases for select to anon, authenticated using (true);

-- Old browser tabs must fail explicitly rather than partially removing one
-- source favorite while another alias keeps the global favorite enabled.
create function public.require_source_binder_favorite_mode()
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
  if coalesce((select enabled from public.global_binder_settings where singleton),false) then
    raise exception 'BINDER_REFRESH_REQUIRED' using errcode='42501';
  end if;
  return true;
end $$;
revoke all on function public.require_source_binder_favorite_mode() from public,anon,authenticated,service_role;
grant execute on function public.require_source_binder_favorite_mode() to authenticated;
create policy global_binder_favorite_insert_compat on public.panini_album_favorites
  as restrictive for insert to authenticated with check(public.require_source_binder_favorite_mode());
create policy global_binder_favorite_delete_compat on public.panini_album_favorites
  as restrictive for delete to authenticated using(public.require_source_binder_favorite_mode());

create function public.resolve_global_binder_license(p_license text, p_category text default '')
returns text language sql stable security invoker set search_path='' as $$
  select coalesce((select a.binder_license from public.global_binder_aliases a
    join public.global_binder_settings s on s.singleton and s.enabled
    where a.source_license=btrim(p_license)
      and (btrim(p_category)='' or a.category=upper(btrim(p_category)))),btrim(p_license))
$$;
revoke all on function public.resolve_global_binder_license(text,text) from public;
grant execute on function public.resolve_global_binder_license(text,text) to anon, authenticated, service_role;

create view public.global_binder_card_franchises with (security_invoker=true) as
select links.card_id, coalesce(a.binder_license,links.franchise) as franchise,
  min(links.position)::smallint as position
from public.card_franchises links join public.cards c on c.id=links.card_id
left join public.global_binder_settings s on s.singleton
left join public.global_binder_aliases a on s.enabled
  and a.category=upper(btrim(c.categorie)) and a.source_license=links.franchise
group by links.card_id,coalesce(a.binder_license,links.franchise);
create view public.global_binder_favorites with (security_invoker=true) as
select f.user_id,coalesce(a.binder_license,f.license) as license,min(f.created_at) as created_at
from public.panini_album_favorites f
left join public.global_binder_settings s on s.singleton
left join public.global_binder_aliases a on s.enabled and a.source_license=f.license
group by f.user_id,coalesce(a.binder_license,f.license);
revoke all on public.global_binder_card_franchises,public.global_binder_favorites from public,anon,authenticated;
grant select on public.global_binder_card_franchises to anon,authenticated,service_role;
grant select on public.global_binder_favorites to authenticated,service_role;

create function public.project_global_binder_widgets(p_widgets jsonb)
returns jsonb language sql stable security invoker set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('category',w.value->>'category','entries',(
    select coalesce(jsonb_agg(e.license order by e.first_position),'[]'::jsonb) from (
      select public.resolve_global_binder_license(entry.value #>> '{}',w.value->>'category') as license,
        min(entry.ordinality) as first_position
      from jsonb_array_elements(w.value->'entries') with ordinality entry(value,ordinality)
      group by public.resolve_global_binder_license(entry.value #>> '{}',w.value->>'category')
    ) e
  )) order by w.ordinality),'[]'::jsonb)
  from jsonb_array_elements(p_widgets) with ordinality w(value,ordinality)
$$;
revoke all on function public.project_global_binder_widgets(jsonb) from public,anon,authenticated,service_role;

-- Preserve the owner/grants/security mode of every existing RPC. This replaces
-- only the two relation names used for binder presentation, never card metadata.
create table public.global_binder_rpc_backups (
  signature text primary key, definition text not null
);
alter table public.global_binder_rpc_backups enable row level security;
revoke all on public.global_binder_rpc_backups from public,anon,authenticated,service_role;
do $$
declare f record; definition text; patched text;
begin
  for f in select p.oid,p.proname,p.oid::regprocedure::text as signature
    from pg_proc p where p.pronamespace='public'::regnamespace and p.proname in (
      'get_panini_albums_page','get_panini_album_cards_page',
      'get_friend_panini_albums_page','get_friend_panini_album_cards_page',
      'get_profile_widget_licenses','get_profile_details'
    )
  loop
    definition:=pg_get_functiondef(f.oid);
    insert into public.global_binder_rpc_backups values(f.signature,definition);
    patched:=replace(replace(definition,'public.card_franchises','public.global_binder_card_franchises'),
      'public.panini_album_favorites','public.global_binder_favorites');
    if f.proname in ('get_panini_albums_page','get_friend_panini_albums_page') then
      patched:=replace(patched, 'catalogue.license ilike ''%'' || safe_query || ''%''',
        '(catalogue.license ilike ''%'' || safe_query || ''%'' or exists (select 1 from public.global_binder_aliases source_aliases join public.global_binder_settings source_settings on source_settings.singleton and source_settings.enabled where source_aliases.binder_license=catalogue.license and source_aliases.source_license ilike ''%'' || safe_query || ''%''))');
    end if;
    if f.proname in ('get_panini_album_cards_page','get_friend_panini_album_cards_page') then
      patched:=replace(patched,'btrim(coalesce(p_license, ''''))',
        'public.resolve_global_binder_license(coalesce(p_license, ''''), coalesce(p_category, ''''))');
    end if;
    if f.proname='get_profile_details' then
      if position('(select profile_widgets from public.user_profiles where user_id = target)' in patched)=0 then
        raise exception 'GLOBAL_BINDER_PROFILE_RPC_DRIFT';
      end if;
      patched:=replace(patched,'(select profile_widgets from public.user_profiles where user_id = target)',
        '(select public.project_global_binder_widgets(profile_widgets) from public.user_profiles where user_id = target)');
    end if;
    execute patched;
  end loop;
end $$;

create or replace function public.get_profile_widget_licenses(
  p_category text,p_query text default '',p_offset integer default 0,p_limit integer default 72
)
returns jsonb language sql stable security invoker set search_path='' as $$
  with licenses as materialized (
    select distinct links.franchise license from public.global_binder_card_franchises links
    join public.cards c on c.id=links.card_id
    where upper(btrim(c.categorie))=upper(btrim(p_category))
      and (strpos(lower(links.franchise),lower(btrim(coalesce(p_query,''))))>0
        or exists(select 1 from public.global_binder_aliases a join public.global_binder_settings s on s.singleton and s.enabled
          where a.binder_license=links.franchise and a.category=upper(btrim(p_category))
            and strpos(lower(a.source_license),lower(btrim(coalesce(p_query,''))))>0))
  ), page as (
    select license from licenses order by license
    offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,72),1),72)
  )
  select jsonb_build_object('items',coalesce((select jsonb_agg(license order by license) from page),'[]'::jsonb),
    'total',(select count(*) from licenses));
$$;

-- Desired-state favorites. Fan out a new group preference to its actual source
-- names so disabling the projection preserves post-migration player choices.
create function public.set_global_binder_favorite(p_license text,p_favorite boolean)
returns void language plpgsql security definer set search_path='' as $$
declare player uuid:=auth.uid(); target text; names text[]; global_preferences boolean;
begin
  if player is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_favorite is null or nullif(btrim(p_license),'') is null or char_length(p_license)>200 then
    raise exception 'INVALID_LICENSE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('binder-favorites:'||player::text,0));
  select preferences_global into global_preferences from public.global_binder_settings where singleton;
  target:=case when global_preferences then coalesce((select binder_license from public.global_binder_aliases where source_license=btrim(p_license)),btrim(p_license)) else btrim(p_license) end;
  select array_agg(distinct links.franchise) into names
    from public.card_franchises links join public.cards c on c.id=links.card_id
    left join public.global_binder_aliases a on global_preferences and a.source_license=links.franchise and a.category=upper(btrim(c.categorie))
    where coalesce(a.binder_license,links.franchise)=target;
  if names is null then raise exception 'INVALID_LICENSE'; end if;
  if p_favorite then
    insert into public.panini_album_favorites(user_id,license)
    select player,unnest(names) on conflict(user_id,license) do nothing;
  else
    delete from public.panini_album_favorites f where f.user_id=player
      and (case when global_preferences then coalesce((select binder_license from public.global_binder_aliases where source_license=f.license),f.license) else f.license end)=target;
  end if;
end $$;
revoke all on function public.set_global_binder_favorite(text,boolean) from public,anon,service_role;
grant execute on function public.set_global_binder_favorite(text,boolean) to authenticated;

-- Source entries are retained in storage. Returned widgets use distinct global
-- names, but rollback can still display the complete source selection.
create or replace function public.update_profile_widgets(p_widgets jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare player uuid:=auth.uid(); widget jsonb; item jsonb; seen text[]:='{}';
  section_category text; target text; stored jsonb:='[]'; entries jsonb; sources jsonb;
  selected_targets text[]; global_preferences boolean;
begin
  if player is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.get_profile(null);
  select preferences_global into global_preferences from public.global_binder_settings where singleton;
  if jsonb_typeof(p_widgets) is distinct from 'array' or octet_length(p_widgets::text)>20000
    or jsonb_array_length(p_widgets)>12 then raise exception 'WIDGETS_INVALID'; end if;
  for widget in select value from jsonb_array_elements(p_widgets) loop
    if jsonb_typeof(widget) is distinct from 'object'
      or jsonb_typeof(widget->'category') is distinct from 'string'
      or jsonb_typeof(widget->'entries') is distinct from 'array'
      or exists(select 1 from jsonb_object_keys(widget) k where k not in ('category','entries'))
      then raise exception 'WIDGETS_INVALID'; end if;
    section_category:=widget->>'category';
    if section_category=any(seen) or not exists(select 1 from public.cards c where upper(btrim(c.categorie))=section_category)
      then raise exception 'WIDGETS_INVALID'; end if;
    seen:=array_append(seen,section_category); entries:='[]'; selected_targets:='{}';
    if jsonb_array_length(widget->'entries')<>(select count(distinct value) from jsonb_array_elements(widget->'entries'))
      then raise exception 'WIDGETS_INVALID'; end if;
    for item in select value from jsonb_array_elements(widget->'entries') loop
      if jsonb_typeof(item)<>'string' then raise exception 'WIDGETS_INVALID'; end if;
      target:=case when global_preferences then coalesce((select binder_license from public.global_binder_aliases a where a.source_license=(item #>> '{}') and a.category=section_category),item #>> '{}') else item #>> '{}' end;
      if target=any(selected_targets) then continue; end if;
      selected_targets:=array_append(selected_targets,target);
      if cardinality(selected_targets)>12 then raise exception 'WIDGETS_INVALID'; end if;
      select jsonb_agg(name order by name) into sources from (
        select distinct links.franchise as name
        from public.card_franchises links join public.cards c on c.id=links.card_id
        left join public.global_binder_aliases a on global_preferences and a.source_license=links.franchise and a.category=upper(btrim(c.categorie))
        where upper(btrim(c.categorie))=section_category
          and coalesce(a.binder_license,links.franchise)=target
      ) raw;
      if sources is null then raise exception 'WIDGETS_INVALID'; end if;
      entries:=entries||sources;
    end loop;
    stored:=stored||jsonb_build_array(jsonb_build_object('category',section_category,'entries',entries));
  end loop;
  update public.user_profiles set profile_widgets=stored where user_id=player;
  return public.project_global_binder_widgets(stored);
end $$;
revoke all on function public.update_profile_widgets(jsonb) from public,anon;
grant execute on function public.update_profile_widgets(jsonb) to authenticated;

-- Operator-only gate. Run again against a fresh catalogue immediately before
-- an explicitly authorized activation. Never infer additional source aliases.
create function public.global_binder_mapping_sha256()
returns text language sql stable security invoker set search_path='' as $$
  select encode(sha256(convert_to(coalesce(string_agg(
    octet_length(convert_to(category,'UTF8'))::text||':'||category||
    octet_length(convert_to(source_license,'UTF8'))::text||':'||source_license||
    octet_length(convert_to(binder_license,'UTF8'))::text||':'||binder_license||
    octet_length(convert_to(evidence,'UTF8'))::text||':'||evidence,
    '' order by convert_to(source_license,'UTF8')),''),'UTF8')),'hex')
  from public.global_binder_aliases
$$;
revoke all on function public.global_binder_mapping_sha256() from public,anon,authenticated,service_role;

create function public.validate_global_binder_mapping()
returns void language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.global_binder_aliases a join public.global_binder_aliases b
    on a.binder_license=b.source_license) then raise exception 'GLOBAL_BINDER_CHAIN'; end if;
  if exists(select 1 from public.global_binder_aliases a where not exists(
    select 1 from public.card_franchises l join public.cards c on c.id=l.card_id
    where l.franchise=a.source_license and upper(btrim(c.categorie))=a.category
  )) then raise exception 'GLOBAL_BINDER_UNKNOWN_SOURCE'; end if;
  if exists(select 1 from public.global_binder_aliases a
    join public.card_franchises l on l.franchise=a.source_license
    join public.cards c on c.id=l.card_id where upper(btrim(c.categorie))<>a.category)
    then raise exception 'GLOBAL_BINDER_CATEGORY_COLLISION'; end if;
  if not exists(select 1 from public.global_binder_settings where singleton and manifest_sha256=public.global_binder_mapping_sha256())
    then raise exception 'GLOBAL_BINDER_MANIFEST_MISMATCH'; end if;
end $$;
revoke all on function public.validate_global_binder_mapping() from public,anon,authenticated,service_role;

create function public.guard_global_binder_activation()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if new.enabled then
    perform public.validate_global_binder_mapping();
    if new.manifest_sha256<>public.global_binder_mapping_sha256() then
      raise exception 'GLOBAL_BINDER_MANIFEST_MISMATCH';
    end if;
  end if;
  return new;
end $$;
revoke all on function public.guard_global_binder_activation() from public,anon,authenticated,service_role;
create trigger guard_global_binder_activation before update of enabled,manifest_sha256
  on public.global_binder_settings for each row execute function public.guard_global_binder_activation();

notify pgrst,'reload schema';
commit;
