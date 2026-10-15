begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

-- No existing copies are converted. Legacy evolved SSR shiny copies stay valid.
update public.achievements set description = 'Evolve five identical SSR copies into a UR.'
  where id = 'transcendance';
alter table public.user_cards drop constraint user_cards_evolved_shiny_ssr_check;
alter table public.user_cards add constraint user_cards_evolved_shiny_ssr_check
  check (not is_evolved or (rarity = 'SSR' and is_shiny) or (rarity = 'UR' and not is_shiny));
alter table public.user_cards add constraint user_cards_ur_evolved_check
  check (rarity <> 'UR' or (is_evolved and not is_shiny));
-- UR belongs to an owned copy, never the booster catalogue's base rarity.
alter table public.cards add constraint cards_no_ur_base_check check (rarete_base <> 'UR');

create or replace function public.evolve_ssr_card(p_card_instance_ids uuid[])
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  player_id uuid := auth.uid(); target_card public.cards%rowtype; selected_count integer;
  evolved_id uuid; evolved_at timestamptz := clock_timestamp();
begin
  if player_id is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_card_instance_ids),0) <> 5
    or (select count(distinct id) from unnest(p_card_instance_ids) as ids(id)) <> 5 then
    raise exception 'FIVE_DISTINCT_SSR_COPIES_REQUIRED' using errcode = 'P0001';
  end if;
  -- The same lock order for every selection prevents cross-selection deadlocks.
  perform 1 from public.user_cards owned
    where owned.id=any(p_card_instance_ids) and owned.user_id=player_id
    order by owned.id for update;
  select cards.* into target_card from public.user_cards owned join public.cards cards on cards.id=owned.card_id
    where owned.id=p_card_instance_ids[1] and owned.user_id=player_id and cards.rarete_base='SSR'
      and owned.rarity='SSR' and not owned.is_shiny;
  if not found then raise exception 'SSR_CARD_NOT_OWNED' using errcode = 'P0001'; end if;
  select count(*) into selected_count from public.user_cards owned where owned.id=any(p_card_instance_ids)
    and owned.user_id=player_id and owned.card_id=target_card.id and owned.rarity='SSR' and not owned.is_shiny;
  if selected_count <> 5 then raise exception 'INVALID_SSR_COPIES' using errcode = 'P0001'; end if;
  if exists(select 1 from public.user_cards where id=any(p_card_instance_ids) and is_locked) then
    raise exception 'CARD_LOCKED' using errcode = 'P0001';
  end if;
  if exists(select 1 from public.auctions where card_instance_id=any(p_card_instance_ids) and status='active') then
    raise exception 'CARD_FROZEN' using errcode = 'P0001';
  end if;
  delete from public.user_cards where user_id=player_id and id=any(p_card_instance_ids);
  insert into public.user_cards(user_id,card_id,date_obtention,rarity,is_shiny,is_evolved,is_first_owner)
    values(player_id,target_card.id,evolved_at,'UR',false,true,false) returning id into evolved_id;
  return jsonb_build_object('id',target_card.id,'name',target_card.nom,'category',target_card.categorie,
    'liveFranchise',true,'anime',target_card.franchise,
    'rarity','UR','image',target_card.image_url,'catalogueImage',target_card.image_url,
    'customImageUrl',null,'instanceId',evolved_id,'obtainedAt',evolved_at,'shiny',false,
    'isEvolved',true,'isFirstOwner',false,'locked',false,'folderId',null);
end; $$;
revoke all on function public.evolve_ssr_card(uuid[]) from public,anon;
grant execute on function public.evolve_ssr_card(uuid[]) to authenticated;

-- Preserve the existing SSR destruction reward; no unrelated economy rebalance.
create or replace function public.card_destruction_value(p_rarity public.card_rarity)
returns integer language sql immutable strict set search_path = '' as $$
  select case p_rarity
    when 'C' then 1 when 'R' then 2 when 'SR' then 3 when 'SSR' then 4 when 'UR' then 4 when 'LR' then 5
  end;
$$;

-- A shared SSR and its evolved UR must not reuse the same public link.
drop index public.card_shares_combination_key;
create unique index card_shares_combination_key
  on public.card_shares(owner_id, card_id, rarity, shiny, show_pseudo);

-- Owned-card read models are updated below without changing their access rules.

-- Preserve existing authorization, privacy and snapshot fallback: profile_card_json
create or replace function public.profile_card_json(c cards, uc user_cards)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object('id',c.id,'name',c.nom,'category',c.categorie,'liveFranchise',true,'anime',c.franchise,
    'rarity',case when uc.rarity='UR' then uc.rarity else c.rarete_base end,'image',coalesce(uc.custom_image_url,c.image_url),'catalogueImage',c.image_url,
    'customImageUrl',uc.custom_image_url,'instanceId',uc.id,'obtainedAt',uc.date_obtention,
    'shiny',uc.is_shiny,'isEvolved',uc.is_evolved,'isFirstOwner',uc.is_first_owner,'folderId',uc.folder_id)
$function$;

-- Preserve existing authorization, privacy and snapshot fallback: trade_card_json
create or replace function public.trade_card_json(p_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'instanceId',uc.id,'id',c.id,'name',c.nom,'category',c.categorie,'liveFranchise',true,'anime',c.franchise,
    'rarity',case when uc.rarity='UR' then uc.rarity else c.rarete_base end,'image',c.image_url,'catalogueImage',c.image_url,'customImageUrl',uc.custom_image_url,
    'shiny',uc.is_shiny,'isEvolved',uc.is_evolved,'isFirstOwner',uc.is_first_owner,
    'obtainedAt',uc.date_obtention,'folderId',uc.folder_id
  ) order by array_position(p_ids,uc.id)),'[]'::jsonb)
  from public.user_cards uc join public.cards c on c.id=uc.card_id where uc.id=any(p_ids)
$function$;

-- Preserve existing authorization, privacy and snapshot fallback: get_friend_collection
create or replace function public.get_friend_collection(p_friend_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare player_id uuid:=auth.uid();
begin
  if player_id is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  if not public.can_view_collection(player_id,p_friend_id) then raise exception 'PROFILE_PRIVATE' using errcode='P0001'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'instanceId',uc.id,'id',c.id,'name',c.nom,'category',c.categorie,'anime',c.franchise,
    'rarity',case when uc.rarity='UR' then uc.rarity else c.rarete_base end,'image',coalesce(uc.custom_image_url,c.image_url),'catalogueImage',c.image_url,
    'customImageUrl',uc.custom_image_url,'obtainedAt',uc.date_obtention,'shiny',uc.is_shiny,
    'isEvolved',uc.is_evolved,'isFirstOwner',uc.is_first_owner,'locked',uc.is_locked,'folderId',null
  ) order by uc.date_obtention desc,uc.id),'[]'::jsonb)
  from public.user_cards uc join public.cards c on c.id=uc.card_id where uc.user_id=p_friend_id);
end; $$;

-- Preserve existing authorization, privacy and snapshot fallback: get_auction
create or replace function public.get_auction(p_auction_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare player_id uuid := auth.uid(); result jsonb;
begin
  if player_id is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  select jsonb_build_object('id',a.id,'card',case when c.id is not null then jsonb_build_object('id',c.id,'name',c.nom,'category',c.categorie,
    'liveFranchise',true,'anime',c.franchise,'rarity',case when uc.rarity='UR' then uc.rarity else c.rarete_base end,'image',c.image_url,'catalogueImage',c.image_url,'shiny',uc.is_shiny) else a.card_snapshot end,
    'amount',a.current_price,'endsAt',a.ends_at,'status',a.status,'seller',coalesce(p.pseudo,'Joueur supprimé'),'sellerId',a.seller_id,
    'sellerAvatarUrl',p.avatar_url,'buyerId',a.buyer_id,'bids',(select count(*) from public.bids b where b.auction_id=a.id),
    'winner',case when a.status='sold' then coalesce((select pseudo from public.user_profiles where user_id=a.buyer_id),'Joueur supprimé') else (select pseudo from public.user_profiles where user_id=a.buyer_id) end,
    'balance',(select karas_balance from public.user_profiles where user_id=player_id),
    'watched',exists(select 1 from public.auction_watchers w where w.auction_id=a.id and w.user_id=player_id),
    'history',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'name',coalesce(bp.pseudo,'Joueur supprimé'),'avatarUrl',bp.avatar_url,
      'amount',b.amount,'createdAt',b.created_at,'mine',b.bidder_id=player_id) order by b.created_at desc),'[]'::jsonb)
      from public.bids b left join public.user_profiles bp on bp.user_id=b.bidder_id where b.auction_id=a.id)) into result
    from public.auctions a left join public.user_cards uc on uc.id=a.card_instance_id left join public.cards c on c.id=uc.card_id
    left join public.user_profiles p on p.user_id=a.seller_id where a.id=p_auction_id and (c.id is not null or a.card_snapshot is not null);
  if result is null then raise exception 'AUCTION_NOT_FOUND' using errcode='P0001'; end if;
  return result;
end; $function$;

-- Preserve existing authorization, privacy and snapshot fallback: list_auctions
create or replace function public.list_auctions()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare player_id uuid := auth.uid();
begin
  if player_id is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  return (with player_bids as materialized (select distinct b.auction_id from public.bids b where b.bidder_id=player_id)
    select coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'card',case when c.id is not null then jsonb_build_object('id',c.id,'name',c.nom,'category',c.categorie,'liveFranchise',true,'anime',c.franchise,
        'rarity',case when uc.rarity='UR' then uc.rarity else c.rarete_base end,'image',c.image_url,'catalogueImage',c.image_url,'shiny',uc.is_shiny) else a.card_snapshot end,
      'amount',a.current_price,'endsAt',a.ends_at,'status',a.status,'seller',coalesce(p.pseudo,'Joueur supprimé'),'sellerId',a.seller_id,
      'sellerAvatarUrl',p.avatar_url,'buyerId',a.buyer_id,'hasBid',pb.auction_id is not null,
      'popularity',coalesce(c.favoris_count,0),'bids',(select count(*) from public.bids b where b.auction_id=a.id),
      'watched',exists(select 1 from public.auction_watchers w where w.auction_id=a.id and w.user_id=player_id)
    ) order by a.ends_at),'[]'::jsonb)
    from public.auctions a left join public.user_cards uc on uc.id=a.card_instance_id
    left join public.cards c on c.id=uc.card_id left join public.user_profiles p on p.user_id=a.seller_id
    left join player_bids pb on pb.auction_id=a.id
    where (c.id is not null or a.card_snapshot is not null) and (a.status='active' or a.seller_id=player_id or a.buyer_id=player_id or pb.auction_id is not null));
end; $function$;

-- Preserve existing authorization, privacy and snapshot fallback: list_auctions_page
create or replace function public.list_auctions_page(p_cursor jsonb DEFAULT NULL::jsonb, p_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare player_id uuid:=auth.uid(); page_size integer:=least(p_limit,100);
begin
  if player_id is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  if p_limit is null or p_limit<1 then raise exception 'INVALID_PAGE_SIZE' using errcode='P0001'; end if;
  return (with player_bids as materialized (select distinct b.auction_id from public.bids b where b.bidder_id=player_id),
  selected as materialized (
    select a.*,uc.is_shiny,c.id card_id,c.nom,c.categorie,c.franchise,case when uc.rarity='UR' then uc.rarity else c.rarete_base end as rarete_base,c.image_url,c.favoris_count,
      p.pseudo,p.avatar_url,pb.auction_id is not null has_bid
    from public.auctions a left join public.user_cards uc on uc.id=a.card_instance_id
    left join public.cards c on c.id=uc.card_id left join public.user_profiles p on p.user_id=a.seller_id
    left join player_bids pb on pb.auction_id=a.id
    where (c.id is not null or a.card_snapshot is not null) and (a.status='active' or a.seller_id=player_id or a.buyer_id=player_id or pb.auction_id is not null)
      and (p_cursor is null or (a.created_at,a.id)>((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid))
    -- Immutable cursor: anti-sniping changes ends_at, never created_at.
    order by a.created_at,a.id limit page_size
  ) select jsonb_build_object(
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'card',case when a.card_id is not null then jsonb_build_object('id',a.card_id,'name',a.nom,'category',a.categorie,'liveFranchise',true,'anime',a.franchise,
        'rarity',a.rarete_base,'image',a.image_url,'catalogueImage',a.image_url,'shiny',a.is_shiny) else a.card_snapshot end,
      'amount',a.current_price,'endsAt',a.ends_at,'status',a.status,'seller',coalesce(a.pseudo,'Joueur supprimé'),'sellerId',a.seller_id,
      'sellerAvatarUrl',a.avatar_url,'buyerId',a.buyer_id,'hasBid',a.has_bid,'popularity',coalesce(a.favoris_count,0),
      'bids',(select count(*) from public.bids b where b.auction_id=a.id),
      'watched',exists(select 1 from public.auction_watchers w where w.auction_id=a.id and w.user_id=player_id)
    ) order by a.created_at,a.id),'[]'::jsonb),
    'nextCursor',case when count(*)=page_size then
      jsonb_agg(jsonb_build_object('createdAt',a.created_at,'id',a.id) order by a.created_at desc,a.id desc)->0 end
  ) from selected a);
end; $function$;

-- Preserve existing authorization, privacy and snapshot fallback: get_profile_active_auctions
create or replace function public.get_profile_active_auctions(
  p_owner_id uuid, p_cursor jsonb default null, p_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare viewer uuid := auth.uid(); base jsonb; page_size integer;
begin
  if viewer is null then raise exception 'AUTH_REQUIRED' using errcode='P0001'; end if;
  if p_owner_id is null then raise exception 'PROFILE_NOT_FOUND' using errcode='P0001'; end if;
  if p_limit is null or p_limit < 1 then raise exception 'INVALID_PAGE_SIZE' using errcode='P0001'; end if;
  page_size := least(p_limit,50);
  base := public.get_profile(p_owner_id::text);
  if not (base->>'canViewCollection')::boolean
    or exists(select 1 from public.account_deletion_log where user_id in(viewer,p_owner_id))
    or exists(select 1 from public.user_blocks where
      (blocker_id=viewer and blocked_id=p_owner_id) or (blocker_id=p_owner_id and blocked_id=viewer)) then
    return jsonb_build_object('items','[]'::jsonb,'nextCursor',null);
  end if;
  if p_cursor is not null and (jsonb_typeof(p_cursor) <> 'object'
    or nullif(p_cursor->>'createdAt','') is null or nullif(p_cursor->>'id','') is null) then
    raise exception 'INVALID_CURSOR' using errcode='P0001';
  end if;
  return (with selected as materialized (
    select a.*,c.id card_id,c.nom,c.categorie,c.franchise,case when uc.rarity='UR' then uc.rarity else c.rarete_base end as rarete_base,c.image_url,uc.is_shiny
    from public.auctions a
    left join public.user_cards uc on uc.id=a.card_instance_id
    left join public.cards c on c.id=uc.card_id
    where a.seller_id=p_owner_id and a.status='active' and a.ends_at>statement_timestamp()
      and (c.id is not null or a.card_snapshot is not null)
      and (p_cursor is null or (a.created_at,a.id)<((p_cursor->>'createdAt')::timestamptz,(p_cursor->>'id')::uuid))
    order by a.created_at desc,a.id desc limit page_size+1
  ), page as (select * from selected order by created_at desc,id desc limit page_size)
  select jsonb_build_object(
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'id',a.id,'card',case when a.card_id is not null then jsonb_build_object(
        'id',a.card_id,'name',a.nom,'category',a.categorie,'anime',a.franchise,'liveFranchise',true,
        'rarity',a.rarete_base,'image',a.image_url,'catalogueImage',a.image_url,'shiny',a.is_shiny) else a.card_snapshot end,
      'amount',a.current_price,'endsAt',a.ends_at,'status',a.status,
      'seller',base->>'pseudo','sellerId',p_owner_id,'sellerAvatarUrl',base->>'avatarUrl',
      'buyerId',a.buyer_id,'hasBid',exists(select 1 from public.bids b where b.auction_id=a.id and b.bidder_id=viewer),
      'bids',(select count(*) from public.bids b where b.auction_id=a.id),
      'watched',exists(select 1 from public.auction_watchers w where w.auction_id=a.id and w.user_id=viewer)
    ) order by a.created_at desc,a.id desc),'[]'::jsonb),
    'nextCursor',case when (select count(*) from selected)>page_size then
      jsonb_agg(jsonb_build_object('createdAt',a.created_at,'id',a.id) order by a.created_at,a.id)->0
      else null end
  ) from page a);
end; $$;

-- Preserve existing authorization, privacy and snapshot fallback: get_profile_details
create or replace function public.get_profile_details(p_identifier text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare base jsonb; target uuid; allowed boolean; result jsonb;
begin
  base := public.get_profile(p_identifier);
  target := (base->>'id')::uuid;
  allowed := (base->>'canViewCollection')::boolean;
  select jsonb_build_object(
    'joinedAt', (select to_jsonb(u)->>'created_at' from auth.users u where u.id = target),
    'interests', (select interests from public.user_profiles where user_id = target),
    'widgets', (select profile_widgets from public.user_profiles where user_id = target),
    'bannerUrl', (select banner_url from public.user_profiles where user_id = target),
    'widgetCategories', coalesce((select jsonb_agg(category order by category) from
      (select distinct upper(btrim(categorie)) category from public.cards where btrim(categorie) <> '') categories), '[]'::jsonb),
    'boostersOpened', case when allowed then
      coalesce((select regular_packs_opened from public.user_achievement_stats where user_id = target), 0)
      + (select count(*) from public.decision_packs where user_id = target) else null end,
    'lrCount', case when allowed then (select count(*) from public.user_cards where user_id = target and rarity = 'LR') else null end,
    'ssrCount', case when allowed then (select count(*) from public.user_cards where user_id = target and rarity = 'SSR') else null end,
    'mutualFriends', case when (base->>'friendsVisible')::boolean then coalesce((
      select jsonb_agg(friend) from jsonb_array_elements(base->'friends') friend
      where exists(select 1 from public.friendships f where f.status = 'accepted'
        and ((f.user_id = auth.uid() and f.friend_id = (friend->>'id')::uuid)
          or (f.friend_id = auth.uid() and f.user_id = (friend->>'id')::uuid)))
    ), '[]'::jsonb) else '[]'::jsonb end,
    'favoriteAlbums', case when allowed then coalesce((
      select jsonb_agg(album order by album->>'license') from (
        select jsonb_build_object('license', f.license, 'total', count(distinct c.id),
          'owned', count(distinct owned.card_id),
          'percent', round(100.0 * count(distinct owned.card_id) / nullif(count(distinct c.id),0))) album
        from public.panini_album_favorites f
        join public.card_franchises links on links.franchise = f.license
        join public.cards c on c.id = links.card_id
        left join (select distinct card_id from public.user_cards where user_id = target) owned on owned.card_id = c.id
        where f.user_id = target group by f.license
      ) albums
    ), '[]'::jsonb) else '[]'::jsonb end,
    'activity', case when allowed then coalesce((
      select jsonb_agg(entry order by happened_at desc, event_id) from (
        select * from (
          select uc.date_obtention happened_at, uc.id::text event_id,
            jsonb_build_object('id', uc.id, 'kind', 'obtained', 'at', uc.date_obtention,
              'card', public.profile_card_json(c,uc)) entry
          from public.user_cards uc join public.cards c on c.id = uc.card_id
          where uc.user_id = target and not exists(select 1 from public.auctions a
            where a.status = 'sold' and a.buyer_id = target and a.card_instance_id = uc.id
              and a.ends_at <= uc.date_obtention and a.ends_at > uc.date_obtention - interval '5 minutes')
          order by uc.date_obtention desc, uc.id limit 20
        ) acquisitions
        union all
        select * from (
          select a.ends_at happened_at, a.id::text event_id,
            jsonb_build_object('id', a.id, 'kind', case when a.seller_id = target then 'sold' else 'bought' end,
              'at', a.ends_at, 'price', a.current_price, 'card', case when c.id is not null then
                jsonb_build_object('id', c.id, 'name', c.nom, 'category', c.categorie,
                  'anime', c.franchise, 'rarity', case when uc.rarity='UR' then uc.rarity else c.rarete_base end, 'image', c.image_url) else a.card_snapshot end) entry
          from public.auctions a left join public.user_cards uc on uc.id = a.card_instance_id
          left join public.cards c on c.id = uc.card_id
          where a.status = 'sold' and (a.seller_id = target or a.buyer_id = target)
            and (c.id is not null or a.card_snapshot is not null)
          order by a.ends_at desc, a.id limit 20
        ) sales
        order by happened_at desc, event_id limit 20
      ) recent
    ), '[]'::jsonb) else '[]'::jsonb end
  ) into result;
  return result;
end; $$;

-- Preserve existing authorization, privacy and snapshot fallback: prepare_account_deletion
create or replace function public.prepare_account_deletion(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare sale record; owned_ids uuid[]; objects jsonb;
begin
  if p_user_id is null or not exists(select 1 from public.account_deletion_log where user_id=p_user_id) then
    raise exception 'ACCOUNT_DELETION_NOT_STARTED' using errcode='P0001';
  end if;
  -- Serialize retries of the same deletion, after the committed fence.
  perform pg_advisory_xact_lock(hashtextextended('account-deletion:'||p_user_id::text,0));
  if exists(select 1 from storage.objects o where o.bucket_id not in ('avatars','profile-wall-media')
    and (o.owner_id=p_user_id::text or to_jsonb(o)->>'owner'=p_user_id::text)) then
    raise exception 'STORAGE_OWNERSHIP_REQUIRES_REVIEW' using errcode='P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket',o.bucket_id,'name',o.name) order by o.name),'[]') into objects
    from storage.objects o where o.bucket_id in ('avatars','profile-wall-media') and
      (o.owner_id=p_user_id::text or to_jsonb(o)->>'owner'=p_user_id::text or split_part(o.name,'/',1)=p_user_id::text);
  -- Auctions first, then all affected balances in UUID order, as in place_bid.
  perform 1 from public.auctions where status='active' and (seller_id=p_user_id or buyer_id=p_user_id) order by id for update;
  -- Social mutators lock friendships, then offers; trade acceptance locks offers
  -- before balances. Preserve those orders while cancelling pending interactions.
  perform 1 from public.friendships where user_id=p_user_id or friend_id=p_user_id order by id for update;
  perform 1 from public.trade_offers where from_user=p_user_id or to_user=p_user_id order by id for update;
  perform 1 from public.user_profiles where user_id=p_user_id or user_id in
    (select buyer_id from public.auctions where status='active' and seller_id=p_user_id)
    order by user_id for no key update;
  for sale in select * from public.auctions where status='active' and (seller_id=p_user_id or buyer_id=p_user_id) order by id loop
    if sale.buyer_id is not null then perform public.credit_karas(sale.buyer_id,sale.current_price); end if;
    if sale.seller_id=p_user_id then
      update public.auctions set status='expired',buyer_id=null where id=sale.id;
    else
      delete from public.bids where auction_id=sale.id and bidder_id=p_user_id;
      update public.auctions set buyer_id=null,current_price=starting_price,
        ends_at=case when ends_at<clock_timestamp()+interval '3 minutes' then greatest(ends_at,clock_timestamp()+interval '5 minutes') else ends_at end
        where id=sale.id;
    end if;
  end loop;
  update public.trade_offers set status='cancelled',updated_at=clock_timestamp()
    where status='pending' and (from_user=p_user_id or to_user=p_user_id);
  select coalesce(array_agg(id),'{}') into owned_ids from public.user_cards where user_id=p_user_id;
  update public.auctions a set card_snapshot=jsonb_build_object('id',c.id,'name',c.nom,'category',c.categorie,'anime',c.franchise,
    'rarity',case when uc.rarity='UR' then uc.rarity else c.rarete_base end,'image',c.image_url,'catalogueImage',c.image_url,'shiny',uc.is_shiny)
    from public.user_cards uc join public.cards c on c.id=uc.card_id
    where uc.id=a.card_instance_id and (uc.user_id=p_user_id or a.seller_id=p_user_id or a.buyer_id=p_user_id);
  update public.trade_offers o set
    offered_cards_snapshot=coalesce(offered_cards_snapshot,(select coalesce(jsonb_agg(v - 'folderId' - 'obtainedAt' - 'customImageUrl' || jsonb_build_object('image',v->'catalogueImage')),'[]') from jsonb_array_elements(public.trade_card_json(o.offered_card_ids)) v)),
    requested_cards_snapshot=coalesce(requested_cards_snapshot,(select coalesce(jsonb_agg(v - 'folderId' - 'obtainedAt' - 'customImageUrl' || jsonb_build_object('image',v->'catalogueImage')),'[]') from jsonb_array_elements(public.trade_card_json(o.requested_card_ids)) v))
    where from_user=p_user_id or to_user=p_user_id or offered_card_ids&&owned_ids or requested_card_ids&&owned_ids;
  -- Structured and free-form report payloads can contain names, emails or bio.
  update public.admin_audit_logs set metadata='{}',card_snapshot=null where admin_user_id=p_user_id
    or position(p_user_id::text in metadata::text)>0
    or metadata->>'report_id' in (select id::text from public.user_reports where reporter_id=p_user_id or reported_id=p_user_id);
  update public.user_reports set snapshot='{}',details='' where reporter_id=p_user_id or reported_id=p_user_id;
  update public.auctions set seller_id=null where seller_id=p_user_id;
  update public.auctions set buyer_id=null where buyer_id=p_user_id;
  update public.bids set bidder_id=null where bidder_id=p_user_id;
  update public.trade_offers set from_user=null where from_user=p_user_id;
  update public.trade_offers set to_user=null where to_user=p_user_id;
  update public.user_reports set reporter_id=null where reporter_id=p_user_id;
  update public.user_reports set reported_id=null where reported_id=p_user_id;
  update public.card_reports set reporter_id=null where reporter_id=p_user_id;
  update public.admin_audit_logs set admin_user_id=null where admin_user_id=p_user_id;
  delete from public.profile_wall_posts where user_id=p_user_id;
  -- Remove messages/notifications/shares rather than retaining personal text.
  delete from public.notifications where user_id=p_user_id or actor_user_id=p_user_id;
  delete from public.auction_chat_messages where user_id=p_user_id;
  delete from public.card_shares where owner_id=p_user_id;
  delete from public.card_share_creations where owner_id=p_user_id;
  delete from public.friendships where user_id=p_user_id or friend_id=p_user_id;
  delete from public.user_blocks where blocker_id=p_user_id or blocked_id=p_user_id;
  delete from public.auction_watchers where user_id=p_user_id;
  delete from public.decision_packs where user_id=p_user_id;
  update public.user_cards set is_locked=false where user_id=p_user_id and is_locked;
  delete from public.user_cards where user_id=p_user_id;
  delete from public.folders where user_id=p_user_id;
  delete from public.wishlists where user_id=p_user_id;
  delete from public.user_achievements where user_id=p_user_id;
  delete from public.user_achievement_stats where user_id=p_user_id;
  delete from public.admin_users where user_id=p_user_id;
  update public.admin_users set granted_by=null where granted_by=p_user_id;
  delete from public.user_profiles where user_id=p_user_id;
  -- No DELETE on auth.users or storage.objects: their APIs own physical deletion.
  return objects;
end; $$;

-- Preserve existing authorization, privacy and snapshot fallback: create_card_share
create or replace function public.create_card_share(p_instance_id uuid, p_show_pseudo boolean default false)
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  snapshot record;
  existing_id text;
  new_id text;
begin
  if player_id is null then raise exception 'AUTH_REQUIRED'; end if;

  -- Serialize creation per player so concurrent requests cannot bypass the daily cap.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(player_id::text, 0));

  select owned.card_id, owned.is_shiny, card.nom, card.franchise,
    case when owned.rarity='UR' then owned.rarity else card.rarete_base end as rarete_base, coalesce(owned.custom_image_url, card.image_url) as image_url, profile.pseudo
  into snapshot
  from public.user_cards owned
  join public.cards card on card.id = owned.card_id
  join public.user_profiles profile on profile.user_id = owned.user_id
  where owned.id = p_instance_id and owned.user_id = player_id;
  if not found then raise exception 'CARD_NOT_OWNED'; end if;

  -- Retention is per player and runs under the same transaction lock.
  delete from public.card_share_creations
  where owner_id = player_id and created_at < pg_catalog.now() - interval '7 days';

  select share.id into existing_id
  from public.card_shares share
  where share.owner_id = player_id
    and share.card_id = snapshot.card_id
    and share.rarity = snapshot.rarete_base
    and share.shiny = snapshot.is_shiny
    and share.show_pseudo = coalesce(p_show_pseudo, false);
  if existing_id is not null then
    -- Refresh only the selected illustration; reusing a link is not a creation.
    update public.card_shares
    set catalogue_image_url = snapshot.image_url
    where id = existing_id and catalogue_image_url is distinct from snapshot.image_url;
    return existing_id;
  end if;

  if (select count(*) from public.card_share_creations creation
      where creation.owner_id = player_id
        and creation.created_at >= pg_catalog.date_trunc('day', pg_catalog.now() at time zone 'UTC') at time zone 'UTC') >= 10
  then
    raise exception 'CARD_SHARE_DAILY_LIMIT';
  end if;

  insert into public.card_shares (
    card_id, owner_id, card_name, franchise, rarity, shiny, show_pseudo,
    catalogue_image_url, display_pseudo
  ) values (
    snapshot.card_id, player_id, snapshot.nom, snapshot.franchise,
    snapshot.rarete_base, snapshot.is_shiny, coalesce(p_show_pseudo, false),
    snapshot.image_url, case when coalesce(p_show_pseudo, false) then snapshot.pseudo end
  ) returning id into new_id;
  insert into public.card_share_creations (owner_id) values (player_id);
  return new_id;
end;
$$;

-- Preserve existing authorization, privacy and snapshot fallback: get_game_info
create or replace function public.get_game_info()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare
  player_id uuid := auth.uid();
  player_name text;
  balance integer;
begin
  if player_id is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  select pseudo, karas_balance into player_name, balance
    from public.user_profiles where user_id = player_id;
  if not found then raise exception 'PROFILE_MISSING' using errcode = 'P0001'; end if;
  return jsonb_build_object(
    'user', jsonb_build_object('id', player_id, 'name', player_name),
    'karasBalance', balance,
    'categories', (select coalesce(jsonb_agg(categorie order by categorie), '[]'::jsonb)
      from (select distinct categorie from public.cards) as categories),
    'rarities', jsonb_build_array('C', 'R', 'SR', 'SSR', 'UR', 'LR'),
    'dropRates', '[{"rarity":"C","percent":72.4},{"rarity":"R","percent":20},{"rarity":"SR","percent":7},{"rarity":"SSR","percent":0.5},{"rarity":"LR","percent":0.1}]'::jsonb,
    'decisionDropRates', public.decision_pack_drop_rates(),
    'shinyRate', 0.1
  );
end;
$$;

-- Preserve existing authorization, privacy and snapshot fallback: get_friend_panini_album_cards_page
create or replace function public.get_friend_panini_album_cards_page(
  p_friend_id uuid,
  p_license text,
  p_query text,
  p_category text,
  p_owned_only boolean,
  p_offset integer,
  p_limit integer,
  p_rarity text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  viewer_id uuid := auth.uid();
  safe_license text := btrim(coalesce(p_license, ''));
  safe_query text := btrim(coalesce(p_query, ''));
  safe_category text := upper(btrim(coalesce(p_category, '')));
  safe_rarity text := upper(btrim(coalesce(p_rarity, '')));
  safe_offset integer := greatest(coalesce(p_offset, 0), 0);
  safe_limit integer := least(greatest(coalesce(p_limit, 24), 1), 60);
begin
  if viewer_id is null then raise exception 'AUTH_REQUIRED' using errcode = 'P0001'; end if;
  if not public.can_view_collection(viewer_id, p_friend_id)
    or public.users_blocked(viewer_id, p_friend_id) then
    raise exception 'PROFILE_PRIVATE' using errcode = 'P0001';
  end if;
  if safe_license = '' then raise exception 'INVALID_LICENSE' using errcode = 'P0001'; end if;
  if safe_rarity not in ('', 'C', 'R', 'SR', 'SSR', 'UR', 'LR') then
    raise exception 'INVALID_RARITY' using errcode = 'P0001';
  end if;

  return (
    with matching as materialized (
      select c.id, c.nom, c.categorie, c.franchise, case when safe_rarity='UR' then 'UR'::public.card_rarity else c.rarete_base end as rarete_base, c.image_url,
        exists (select 1 from public.user_cards uc
          where uc.user_id = p_friend_id and uc.card_id = c.id) as owned
      from public.cards c
      where exists (select 1 from public.card_franchises links
          where links.card_id = c.id and links.franchise = safe_license)
        and (safe_category = '' or upper(btrim(c.categorie)) = safe_category)
        and (safe_query = '' or c.nom ilike '%' || safe_query || '%')
        and (safe_rarity = '' or (safe_rarity <> 'UR' and c.rarete_base = nullif(safe_rarity, '')::public.card_rarity)
          or (safe_rarity = 'UR' and exists(select 1 from public.user_cards ur
            where ur.user_id=p_friend_id and ur.card_id=c.id and ur.rarity='UR')))
    ),
    eligible as materialized (
      select * from matching
      where not coalesce(p_owned_only, false) or matching.owned
    ),
    selected as (
      select * from eligible
      order by case rarete_base
          when 'LR' then 0 when 'UR' then 1 when 'SSR' then 2 when 'SR' then 3
          when 'R' then 4 when 'C' then 5 else 6 end,
        nom, id
      offset safe_offset limit safe_limit
    )
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(jsonb_build_object(
        'id', selected.id, 'name', selected.nom, 'category', selected.categorie,
        'anime', selected.franchise, 'rarity', selected.rarete_base,
        'image', selected.image_url, 'owned', selected.owned
      ) order by case selected.rarete_base
          when 'LR' then 0 when 'UR' then 1 when 'SSR' then 2 when 'SR' then 3
          when 'R' then 4 when 'C' then 5 else 6 end,
        selected.nom, selected.id), '[]'::jsonb),
      'total', (select count(*)::integer from eligible)
    ) from selected
  );
end;
$$;

notify pgrst, 'reload schema';
commit;
