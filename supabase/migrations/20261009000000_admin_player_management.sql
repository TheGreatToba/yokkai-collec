begin;

alter table public.admin_audit_logs drop constraint if exists admin_audit_logs_action_check;
alter table public.admin_audit_logs add constraint admin_audit_logs_action_check check (action in (
  'card.create','card.update','card.delete','card.import','player.ban','player.unban'
));

create or replace function public.admin_list_players(p_query text default '', p_limit integer default 50, p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare clean_query text := left(btrim(coalesce(p_query,'')),100); safe_limit integer := least(greatest(coalesce(p_limit,50),1),100); safe_offset integer := greatest(coalesce(p_offset,0),0);
begin
  if not public.is_current_user_admin() then raise exception 'ADMIN_REQUIRED' using errcode='P0001'; end if;
  return jsonb_build_object(
    'total',(select count(*) from auth.users u left join public.user_profiles p on p.user_id=u.id where clean_query='' or coalesce(p.pseudo,'') ilike '%'||clean_query||'%' or coalesce(u.email,'') ilike '%'||clean_query||'%'),
    'players',coalesce((select jsonb_agg(jsonb_build_object(
      'userId',listed.id,'pseudo',listed.pseudo,'email',listed.email,'createdAt',listed.created_at,
      'lastSeenAt',listed.last_seen_at,'cardsCount',listed.cards_count,'karasBalance',listed.karas_balance,
      'isBanned',listed.banned_until is not null and listed.banned_until>now(),'isAdmin',listed.is_admin
    ) order by listed.created_at desc) from (
      select u.id,coalesce(p.pseudo,split_part(coalesce(u.email,'Joueur'),'@',1),'Joueur') pseudo,coalesce(u.email,'') email,u.created_at,p.last_seen_at,coalesce(p.karas_balance,0) karas_balance,u.banned_until,
        exists(select 1 from public.admin_users au where au.user_id=u.id) is_admin,
        (select count(*) from public.user_cards uc where uc.user_id=u.id) cards_count
      from auth.users u left join public.user_profiles p on p.user_id=u.id
      where clean_query='' or coalesce(p.pseudo,'') ilike '%'||clean_query||'%' or coalesce(u.email,'') ilike '%'||clean_query||'%'
      order by u.created_at desc limit safe_limit offset safe_offset
    ) listed),'[]'::jsonb)
  );
end; $$;

create or replace function public.admin_get_player(p_user_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.is_current_user_admin() then raise exception 'ADMIN_REQUIRED' using errcode='P0001'; end if;
  select jsonb_build_object(
    'userId',u.id,'pseudo',coalesce(p.pseudo,split_part(coalesce(u.email,'Joueur'),'@',1),'Joueur'),'email',coalesce(u.email,''),'createdAt',u.created_at,'lastSeenAt',p.last_seen_at,
    'cardsCount',(select count(*) from public.user_cards uc where uc.user_id=u.id),'karasBalance',coalesce(p.karas_balance,0),
    'isBanned',u.banned_until is not null and u.banned_until>now(),
    'isAdmin',exists(select 1 from public.admin_users au where au.user_id=u.id),
    'cards',coalesce((select jsonb_agg(jsonb_build_object(
      'instanceId',owned.id,'name',card.nom,'category',card.categorie,'franchise',card.franchise,
      'rarity',owned.rarity,'imageUrl',coalesce(owned.custom_image_url,card.image_url),
      'obtainedAt',owned.date_obtention,'shiny',owned.is_shiny
    ) order by owned.date_obtention desc) from public.user_cards owned join public.cards card on card.id=owned.card_id where owned.user_id=u.id),'[]'::jsonb)
  ) into result from auth.users u left join public.user_profiles p on p.user_id=u.id where u.id=p_user_id;
  if result is null then raise exception 'PLAYER_NOT_FOUND' using errcode='P0001'; end if;
  return result;
end; $$;

create or replace function public.admin_set_user_ban(p_user_id uuid,p_banned boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_current_user_admin() then raise exception 'ADMIN_REQUIRED' using errcode='P0001'; end if;
  if p_user_id=auth.uid() then raise exception 'CANNOT_BAN_SELF' using errcode='P0001'; end if;
  if exists(select 1 from public.admin_users where user_id=p_user_id) then raise exception 'CANNOT_BAN_ADMIN' using errcode='P0001'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'PLAYER_NOT_FOUND' using errcode='P0001'; end if;
  update auth.users set banned_until=case when p_banned then 'infinity'::timestamptz else null end, updated_at=now() where id=p_user_id;
  if p_banned then delete from auth.sessions where user_id=p_user_id; end if;
  insert into public.admin_audit_logs(admin_user_id,action,metadata) values(auth.uid(),case when p_banned then 'player.ban' else 'player.unban' end,jsonb_build_object('target_user_id',p_user_id));
end; $$;

revoke all on function public.admin_list_players(text,integer,integer),public.admin_get_player(uuid),public.admin_set_user_ban(uuid,boolean) from public,anon,authenticated;
grant execute on function public.admin_list_players(text,integer,integer),public.admin_get_player(uuid),public.admin_set_user_ban(uuid,boolean) to authenticated;

commit;
