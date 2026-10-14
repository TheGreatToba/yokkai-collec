begin;

create or replace function public.normalize_card_franchise(value text)
returns text
language plpgsql
stable
strict
set search_path = ''
as $$
declare
  normalized text := btrim(value);
  candidate text;
  previous text;
  skip_movie_normalization boolean := false;
begin
  -- Families whose sequels use a proper subtitle rather than an explicit
  -- season number. Keep this list intentionally explicit: a shared first word
  -- is not enough to prove that two works belong to the same licence.
  normalized := case
    when normalized ~* '^noragami([[:space:]:-]|$)'
      then 'Noragami'
    when normalized ~* '^one[[:space:]]+piece([[:space:]:-]|$)'
      then 'One Piece'
    when normalized ~* '^naruto([[:space:]:-]|$)'
      or normalized ~* '^road[[:space:]]+to[[:space:]]+ninja:[[:space:]]*naruto[[:space:]]+the[[:space:]]+movie'
      or normalized ~* '^boruto:[[:space:]]*naruto[[:space:]]+the[[:space:]]+movie'
      then 'Naruto'
    when normalized ~* '^pok[eé]mon([[:space:]:-]|$).*(movie|film)'
      then 'Pokémon'
    when normalized ~* '^sailor[[:space:]]+moon([[:space:]:-]|$).*(movie|film)'
      then 'Sailor Moon'
    when normalized ~* '^persona[[:space:]]+3[[:space:]]+the[[:space:]]+movie([[:space:][:punct:]]|$)'
      then 'Persona 3'
    when normalized ~* '^love[[:space:]]+hina([[:space:]:-]|$).*(movie|film)'
      then 'Love Hina'
    else normalized
  end;

  -- Bonus labels are removed only when the exact canonical licence already
  -- exists. This prevents false merges for real titles ending in "Special".
  candidate := btrim(regexp_replace(
    normalized,
    '([[:space:]]|:|–|—|-)+(ova([[:space:]]+collection)?|ona|oad|specials?|special[[:space:]]+episodes?)([[:space:][:punct:]].*)?$',
    '',
    'i'
  ));
  if candidate <> normalized and candidate <> '' and exists (
    select 1 from public.card_franchises links
    where lower(btrim(links.franchise)) = lower(candidate)
    union all
    select 1 from public.cards cards
    where upper(btrim(cards.categorie)) = 'ANIME/MANGA'
      and lower(btrim(cards.franchise)) = lower(candidate)
    limit 1
  ) then
    normalized := candidate;
  end if;

  skip_movie_normalization := normalized ~* '(opening[[:space:]]+movie|short[[:space:]]+movies?|special[[:space:]]+movie|with[[:space:]]+a[[:space:]]+film[[:space:]]+director)';

  if not skip_movie_normalization then
    normalized := btrim(regexp_replace(
      normalized,
      '[[:space:]]*\([[:space:]]*(movie|film)[[:space:]]*\)[[:space:]]*$',
      '',
      'i'
    ));
    normalized := btrim(regexp_replace(
      normalized,
      '[[:space:]]*[-–—:]?[[:space:]]*(the[[:space:]]+movie|the[[:space:]]+motion[[:space:]]+picture|der[[:space:]]+film|movie|film)([[:space:]]+[#0-9]+)?([[:space:]]*[-–—:].*)?[[:space:]]*$',
      '',
      'i'
    ));
  end if;

  loop
    previous := normalized;
    normalized := btrim(regexp_replace(
      normalized,
      '[[:space:]]*[-–—:]?[[:space:]]*\(?(the[[:space:]]+final[[:space:]]+season|final[[:space:]]+season|([0-9]+(st|nd|rd|th)?|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)[[:space:]]+season|season(s)?[[:space:].-]*(final|[0-9]+|i|ii|iii|iv|v|vi|vii|viii|ix|x)([[:space:]]*&[[:space:]]*([0-9]+|i|ii|iii|iv|v|vi|vii|viii|ix|x))?|cour[[:space:].-]*([0-9]+|i|ii|iii|iv|v|vi|vii|viii|ix|x)|part[[:space:].-]*([0-9]+|one|two|three|four|i|ii|iii|iv|v|vi|vii|viii|ix|x))\)?([[:space:][:punct:]].*)?$',
      '',
      'i'
    ));

    exit when normalized = previous or normalized = '';
  end loop;

  if normalized = '' then
    return btrim(value);
  end if;

  return normalized;
end;
$$;

comment on function public.normalize_card_franchise(text) is
  'Canonicalizes audited anime sequel, movie, season, cour, part, OVA, ONA, OAD and special franchise variants.';

create or replace function public.normalize_cards_franchise_before_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if upper(btrim(new.categorie)) = 'ANIME/MANGA'
    and nullif(btrim(new.franchise), '') is not null then
    new.franchise := public.normalize_card_franchise(new.franchise);
  end if;
  return new;
end;
$$;

drop trigger if exists cards_normalize_franchise_before_write on public.cards;
create trigger cards_normalize_franchise_before_write
before insert or update of categorie, franchise on public.cards
for each row execute function public.normalize_cards_franchise_before_write();

revoke all on function public.normalize_cards_franchise_before_write()
  from public, anon, authenticated;

create temporary table franchise_alias_map on commit drop as
select distinct links.franchise as alias,
  public.normalize_card_franchise(links.franchise) as canonical
from public.card_franchises links
join public.cards cards on cards.id = links.card_id
where upper(btrim(cards.categorie)) = 'ANIME/MANGA'
  and links.franchise is distinct from public.normalize_card_franchise(links.franchise);

-- Normalize the visible licence stored on the card.
update public.cards
set franchise = public.normalize_card_franchise(franchise)
where upper(btrim(categorie)) = 'ANIME/MANGA'
  and nullif(btrim(franchise), '') is not null
  and franchise is distinct from public.normalize_card_franchise(franchise);

-- Remove only aliases whose canonical link already exists on the same card,
-- then rename every remaining alias in place.
delete from public.card_franchises links
using pg_temp.franchise_alias_map aliases
where links.franchise = aliases.alias
  and exists (
    select 1 from public.card_franchises canonical
    where canonical.card_id = links.card_id
      and lower(btrim(canonical.franchise)) = lower(btrim(aliases.canonical))
      and canonical.franchise <> links.franchise
  );

update public.card_franchises links
set franchise = aliases.canonical
from pg_temp.franchise_alias_map aliases
where links.franchise = aliases.alias;

-- Preserve album favourites when their old alias disappears.
delete from public.panini_album_favorites favorites
using pg_temp.franchise_alias_map aliases
where favorites.license = aliases.alias
  and exists (
    select 1 from public.panini_album_favorites canonical
    where canonical.user_id = favorites.user_id
      and lower(btrim(canonical.license)) = lower(btrim(aliases.canonical))
      and canonical.license <> favorites.license
  );

update public.panini_album_favorites favorites
set license = aliases.canonical
from pg_temp.franchise_alias_map aliases
where favorites.license = aliases.alias;

commit;
