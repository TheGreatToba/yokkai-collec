begin;

-- Preserve the existing reserve conversion and daily Decision rules. Only the
-- downgrade cutoff changes: use the last legitimate entitlement's actual end,
-- not the first browser visit after a manual grant expired.
create or replace function public.billing_sync_pack_timing(p_user uuid,p_cutoff timestamptz default null) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  profile public.user_profiles;
  paid boolean;
  stamp timestamptz;
  cutoff timestamptz;
  regular_seconds integer;
  decision_seconds integer;
begin
  select * into profile from public.user_profiles where user_id=p_user for update;
  if not found then return; end if;
  stamp:=clock_timestamp();
  paid:=public.billing_has_game_pro(p_user);
  regular_seconds:=case when paid then 300 else 600 end;
  decision_seconds:=case when paid then 43200 else 86400 end;
  if profile.regular_pack_interval_seconds=regular_seconds
    and profile.decision_pack_interval_seconds=decision_seconds then return; end if;
  cutoff:=stamp;
  if not paid and profile.regular_pack_interval_seconds=300 then
    -- Overlapping sources keep Pro until the later expiry. Only a payment
    -- mirror otherwise eligible in the enabled scope contributes an expiry.
    -- Explicit revocation/scope-change events contribute their own cutoff.
    select coalesce(max(ended_at),stamp) into cutoff from (
      select least(stamp,p_cutoff) ended_at where p_cutoff is not null
      union all
      select g.expires_at from public.pro_access_grants g
        where g.user_id=p_user and g.expires_at<=stamp
      union all
      select least(a.period_end,a.verified_at+interval '15 minutes')
        from public.billing_accounts a join public.billing_entitlement_config c
          on c.singleton and c.enabled and c.scope=a.scope
        where a.user_id=p_user and a.active and a.status='active' and not a.risk_hold
          and a.verified_at<=stamp
          and least(a.period_end,a.verified_at+interval '15 minutes')<=stamp
    ) ended;
  end if;
  update public.user_profiles set
    next_regular_pack_at=cutoff+
      (greatest(profile.next_regular_pack_at,cutoff-make_interval(secs=>4*profile.regular_pack_interval_seconds))-cutoff)
      *(regular_seconds::double precision/profile.regular_pack_interval_seconds),
    regular_pack_interval_seconds=regular_seconds,
    decision_pack_interval_seconds=decision_seconds
    where user_id=p_user;
end;
$$;

-- An already expired grant must not lose its historical cutoff when removed.
create or replace function public.billing_sync_manual_pro_access() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op='DELETE' then
    perform public.billing_sync_pack_timing(old.user_id,least(clock_timestamp(),old.expires_at));
  elsif tg_op='UPDATE' then
    perform public.billing_sync_pack_timing(new.user_id,least(clock_timestamp(),old.expires_at,new.expires_at));
  else
    perform public.billing_sync_pack_timing(new.user_id);
  end if;
  return null;
end;
$$;

-- Reconcile an expired old grant before renewing it. The existing AFTER
-- trigger converts corrected progress to the new tier or handles deletion.
create or replace function public.billing_set_manual_pro_access(
  p_user uuid,
  p_enabled boolean,
  p_reason text default null,
  p_expires_at timestamptz default null,
  p_granted_by uuid default null
) returns void
language plpgsql security invoker set search_path = '' as $$
declare prior_expiry timestamptz;
begin
  if p_user is null or p_enabled is null then
    raise exception 'PRO_GRANT_INVALID';
  end if;
  if p_granted_by is not null and not exists (
    select 1 from public.admin_users where user_id=p_granted_by
  ) then
    raise exception 'PRO_GRANT_FORBIDDEN';
  end if;
  if p_enabled then
    if p_reason is null or char_length(btrim(p_reason)) not between 3 and 240
      or (p_expires_at is not null and p_expires_at<=clock_timestamp()) then
      raise exception 'PRO_GRANT_INVALID';
    end if;
    -- Match the existing grant-row -> profile-row trigger lock order. Lock the
    -- old grant before reconciling it; do not introduce profile -> grant waits.
    select expires_at into prior_expiry from public.pro_access_grants where user_id=p_user for update;
    if found and prior_expiry<=clock_timestamp() then
      perform public.billing_sync_pack_timing(p_user);
    end if;
    insert into public.pro_access_grants(user_id,reason,expires_at,granted_by)
      values(p_user,btrim(p_reason),p_expires_at,p_granted_by)
    on conflict(user_id) do update set
      reason=excluded.reason,
      expires_at=excluded.expires_at,
      granted_by=excluded.granted_by,
      updated_at=clock_timestamp();
  else
    delete from public.pro_access_grants where user_id=p_user;
  end if;
end;
$$;

-- A scope change is an immediate operator event, not an old grant's expiry.
create or replace function public.billing_set_entitlement_scope(p_scope text,p_enabled boolean) returns void
language plpgsql security invoker set search_path = '' as $$
declare player uuid; cutoff timestamptz;
begin
  if p_scope is null or p_scope !~ '^(test|live):acct_[A-Za-z0-9]+:price_[A-Za-z0-9]+$' or p_enabled is null
    then raise exception 'BILLING_CONFIGURATION'; end if;
  update public.billing_entitlement_config set scope=p_scope,enabled=p_enabled where singleton;
  cutoff:=clock_timestamp();
  for player in select user_id from public.billing_accounts order by user_id loop
    perform public.billing_sync_pack_timing(player,cutoff);
  end loop;
end;
$$;

-- CREATE OR REPLACE preserves the existing owners, signatures and ACLs.
-- Repeat existing application entry-point restrictions, never widen access.
revoke all on function public.billing_sync_pack_timing(uuid,timestamptz),
  public.billing_set_manual_pro_access(uuid,boolean,text,timestamptz,uuid),
  public.billing_set_entitlement_scope(text,boolean)
  from public,anon,authenticated;
grant execute on function public.billing_sync_pack_timing(uuid,timestamptz),
  public.billing_set_manual_pro_access(uuid,boolean,text,timestamptz,uuid),
  public.billing_set_entitlement_scope(text,boolean) to service_role;

notify pgrst,'reload schema';
commit;
