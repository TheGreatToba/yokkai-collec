begin;
-- Commit the enum extension before the following migration uses the new value.
alter type public.card_rarity add value if not exists 'UR' before 'LR';
commit;
