begin;

alter table public.user_profiles
  add column bonus_regular_packs integer not null default 0
  check (bonus_regular_packs >= 0);
revoke all (bonus_regular_packs) on public.user_profiles from anon, authenticated;

create table public.referral_codes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  code text not null unique check (code ~ '^[a-f0-9]{12}$'),
  created_at timestamptz not null default clock_timestamp()
);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  code_id uuid not null references public.referral_codes (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  referred_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default clock_timestamp(),
  verified_at timestamptz,
  rewarded_at timestamptz,
  reward_packs integer not null default 5 check (reward_packs = 5),
  check (referrer_id <> referred_id),
  check (rewarded_at is null or verified_at is not null)
);

create index referrals_referrer_created_idx
  on public.referrals (referrer_id, created_at desc);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
revoke all on public.referral_codes, public.referrals
  from public, anon, authenticated;
grant all on public.referral_codes, public.referrals to service_role;

create function public.complete_referral_after_verification(
  p_referred_id uuid,
  p_verified_at timestamptz
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  referral public.referrals;
begin
  if p_referred_id is null or p_verified_at is null then return; end if;

  select * into referral
    from public.referrals
    where referred_id = p_referred_id
    for update;
  if not found or referral.rewarded_at is not null then return; end if;

  update public.user_profiles
    set bonus_regular_packs = bonus_regular_packs + referral.reward_packs
    where user_id = referral.referrer_id;
  if not found then return; end if;

  update public.referrals
    set verified_at = p_verified_at,
        rewarded_at = clock_timestamp()
    where id = referral.id and rewarded_at is null;
end;
$$;
revoke all on function public.complete_referral_after_verification(uuid, timestamptz)
  from public, anon, authenticated;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_pseudo text := btrim(new.raw_user_meta_data ->> 'pseudo');
  submitted_code text := lower(btrim(new.raw_user_meta_data ->> 'referral_code'));
begin
  if char_length(clean_pseudo) < 3 then
    raise exception 'PSEUDO_TOO_SHORT' using errcode = 'P0001';
  end if;
  if char_length(clean_pseudo) > 30 then
    raise exception 'PSEUDO_TOO_LONG' using errcode = 'P0001';
  end if;
  if clean_pseudo ~ '[/\\?#%<>[:cntrl:]]' then
    raise exception 'PSEUDO_INVALID_CHARACTERS' using errcode = 'P0001';
  end if;

  insert into public.user_profiles (user_id, pseudo)
  values (new.id, clean_pseudo);

  if submitted_code ~ '^[a-f0-9]{12}$' then
    insert into public.referrals (code_id, referrer_id, referred_id)
      select codes.id, codes.user_id, new.id
      from public.referral_codes codes
      where codes.code = submitted_code and codes.user_id <> new.id
      on conflict (referred_id) do nothing;
  end if;

  if new.email_confirmed_at is not null then
    perform public.complete_referral_after_verification(
      new.id,
      new.email_confirmed_at
    );
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user_profile()
  from public, anon, authenticated;

create function public.on_referral_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.complete_referral_after_verification(
    new.id,
    new.email_confirmed_at
  );
  return new;
end;
$$;
revoke all on function public.on_referral_email_confirmed()
  from public, anon, authenticated;

create trigger on_auth_user_confirmed_referral
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.on_referral_email_confirmed();

create function public.create_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  player uuid := auth.uid();
  existing_code text;
  candidate text;
begin
  if player is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (
    select 1 from public.user_profiles where user_id = player
  ) then raise exception 'PROFILE_MISSING'; end if;
  if exists (
    select 1 from public.account_deletion_log where user_id = player
  ) then raise exception 'ACCOUNT_DELETING'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended('referral-code:' || player::text, 0)
  );
  select code into existing_code
    from public.referral_codes where user_id = player;
  if existing_code is not null then return existing_code; end if;

  loop
    candidate := substring(replace(gen_random_uuid()::text, '-', '') from 1 for 12);
    insert into public.referral_codes (user_id, code)
      values (player, candidate)
      on conflict (code) do nothing
      returning code into existing_code;
    if existing_code is not null then return existing_code; end if;
  end loop;
end;
$$;

create function public.get_referral_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  player uuid := auth.uid();
  referral_code text;
  verified_count integer;
  earned integer;
  bonus integer;
begin
  if player is null then raise exception 'AUTH_REQUIRED'; end if;
  select bonus_regular_packs into bonus
    from public.user_profiles where user_id = player;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  select code into referral_code
    from public.referral_codes where user_id = player;
  select count(*)::integer,
      coalesce(sum(reward_packs) filter (where rewarded_at is not null), 0)::integer
    into verified_count, earned
    from public.referrals
    where referrer_id = player and rewarded_at is not null;
  return jsonb_build_object(
    'code', referral_code,
    'verifiedReferrals', verified_count,
    'packsEarned', earned,
    'bonusPacks', bonus
  );
end;
$$;

revoke all on function public.create_referral_code(), public.get_referral_status()
  from public, anon;
grant execute on function public.create_referral_code(), public.get_referral_status()
  to authenticated;

create or replace function public.get_regular_pack_status()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare player uuid:=auth.uid(); deadline timestamptz; stamp timestamptz;
  step integer; reserve_available integer; bonus integer;
begin
  if player is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.billing_sync_pack_timing(player);
  select next_regular_pack_at,regular_pack_interval_seconds,bonus_regular_packs
    into deadline,step,bonus
    from public.user_profiles where user_id=player;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  stamp:=clock_timestamp();
  reserve_available:=least(5,greatest(0,1+floor(extract(epoch from(stamp-deadline))/step)))::integer;
  return jsonb_build_object(
    'available',reserve_available+bonus,
    'maximum',5,
    'reserve',reserve_available,
    'bonus',bonus,
    'nextPackAt',case when reserve_available=5 then null else extract(epoch from(deadline+make_interval(secs=>reserve_available*step)))*1000 end,
    'serverNow',extract(epoch from stamp)*1000,
    'refillSeconds',step
  );
end;
$$;

create or replace function public.open_regular_pack()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  player_id uuid:=auth.uid(); deadline timestamptz; server_now timestamptz;
  step integer; bonus integer;
  pool_sizes bigint[]; rarity_index integer;
  rarities public.card_rarity[]:=array['C','R','SR','SSR','LR']::public.card_rarity[];
  roll double precision; shiny boolean; selected_card public.cards%rowtype;
  copy_id uuid; copy_ids uuid[]:='{}'; card_ids uuid[]:='{}'; shinies boolean[]:='{}';
  result jsonb:='[]'::jsonb;
begin
  if player_id is null then raise exception 'AUTH_REQUIRED'; end if;
  perform public.billing_sync_pack_timing(player_id);
  select next_regular_pack_at,regular_pack_interval_seconds,bonus_regular_packs
    into deadline,step,bonus
    from public.user_profiles where user_id=player_id for update;
  if not found then raise exception 'PROFILE_MISSING'; end if;
  server_now:=clock_timestamp();
  if bonus=0 and deadline>server_now then raise exception 'PACK_NOT_READY'; end if;
  select array[count(*) filter(where rarete_base='C'),count(*) filter(where rarete_base='R'),
    count(*) filter(where rarete_base='SR'),count(*) filter(where rarete_base='SSR'),
    count(*) filter(where rarete_base='LR')] into pool_sizes from public.cards;
  if 0=any(pool_sizes) then raise exception 'CATALOGUE_INCOMPLETE'; end if;
  for position in 1..5 loop
    roll:=random();
    rarity_index:=case when roll<.724 then 1 when roll<.924 then 2 when roll<.994 then 3 when roll<.999 then 4 else 5 end;
    select * into selected_card from public.cards where rarete_base=rarities[rarity_index]
      order by id offset floor(random()*pool_sizes[rarity_index])::bigint limit 1;
    shiny:=selected_card.rarete_base='LR' and random()<.001;
    copy_id:=gen_random_uuid();
    copy_ids:=array_append(copy_ids,copy_id); card_ids:=array_append(card_ids,selected_card.id); shinies:=array_append(shinies,shiny);
    result:=result||jsonb_build_array(jsonb_build_object(
      'id',selected_card.id,'name',selected_card.nom,'category',selected_card.categorie,
      'liveFranchise',true,'anime',selected_card.franchise,'rarity',selected_card.rarete_base,'image',selected_card.image_url,
      'catalogueImage',selected_card.image_url,'customImageUrl',null,
      'instanceId',copy_id,'obtainedAt',server_now,'shiny',shiny,'isEvolved',false,
      'isFirstOwner',selected_card.rarete_base='LR','folderId',null));
  end loop;
  insert into public.user_cards(id,user_id,card_id,date_obtention,rarity,is_shiny,is_evolved,is_first_owner)
    select drawn.id,player_id,drawn.card_id,server_now,c.rarete_base,drawn.shiny,false,c.rarete_base='LR'
    from unnest(copy_ids,card_ids,shinies) as drawn(id,card_id,shiny) join public.cards c on c.id=drawn.card_id;
  update public.user_profiles set
    bonus_regular_packs=case when bonus>0 then bonus-1 else 0 end,
    next_regular_pack_at=case when bonus>0 then deadline
      else greatest(deadline,server_now-make_interval(secs=>4*step))+make_interval(secs=>step) end
    where user_id=player_id;
  perform public.ensure_achievement_stats(player_id);
  update public.user_achievement_stats set regular_packs_opened=regular_packs_opened+1 where user_id=player_id;
  perform public.complete_achievements(player_id,array['regular_packs_opened']);
  return result;
end;
$$;

revoke all on function public.get_regular_pack_status(), public.open_regular_pack()
  from public, anon;
grant execute on function public.get_regular_pack_status(), public.open_regular_pack()
  to authenticated;

notify pgrst, 'reload schema';
commit;
