begin;

-- Only public catalogue metadata is aggregated; RLS still applies to the caller.
create function public.get_catalogue_filter_counts()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with counts as materialized (
    select categorie, rarete_base::text as rarity, count(*) as amount
    from public.cards
    group by categorie, rarete_base
  )
  select jsonb_build_object(
    'total', coalesce((select sum(amount) from counts), 0),
    'rarities', coalesce((
      select jsonb_object_agg(rarity, amount)
      from (select rarity, sum(amount) as amount from counts group by rarity) r
    ), '{}'::jsonb),
    'categories', coalesce((
      select jsonb_object_agg(categorie, amount)
      from (select categorie, sum(amount) as amount from counts group by categorie) c
    ), '{}'::jsonb)
  );
$$;

revoke all on function public.get_catalogue_filter_counts() from public, anon;
grant execute on function public.get_catalogue_filter_counts() to authenticated;

commit;
