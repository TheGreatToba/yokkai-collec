import assert from "node:assert/strict";
import test from "node:test";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

const player = "70000000-0000-4000-8000-000000000001";

test("les albums Panini sont paginés et leurs cartes chargées à la demande", async t => {
  const { db } = await replayMigrations();
  t.after(() => db.close());

  await db.query(
    "insert into auth.users(id,raw_user_meta_data) values ($1,$2::jsonb)",
    [player, JSON.stringify({ pseudo: "PaniniPage" })]
  );
  await db.exec(`
    insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    select 'panini-' || i, 'Carte ' || i, 'ANIME/MANGA', 'Licence ' || lpad(i::text, 3, '0'),
      'C', 'https://example.test/' || i || '.png', 'panini-test'
    from generate_series(1,75) i;
    insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    values
      ('film-a','Film A','FILM','Alien','R','https://example.test/film-a.png','panini-test'),
      ('film-b','Film B','FILM','Matrix','SR','https://example.test/film-b.png','panini-test');
  `);
  const ownedCard = (
    await db.query("select id from public.cards where source_id='panini-1'")
  ).rows[0].id;
  await db.query(
    "insert into public.user_cards(user_id,card_id,rarity) values ($1,$2,'C')",
    [player, ownedCard]
  );

  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    player
  ]);

  const first = (
    await db.query(
      "select public.get_panini_albums_page('', '', 0, 72) as value"
    )
  ).rows[0].value;
  assert.equal(first.items.length, 72);
  assert.equal(first.total, 76);
  assert.deepEqual(first.items[0], {
    license: "Licence 001",
    total: 1,
    owned: 1,
    percent: 100
  });

  const second = (
    await db.query(
      "select public.get_panini_albums_page('', '', 72, 72) as value"
    )
  ).rows[0].value;
  assert.equal(second.items.length, 4);
  assert.equal(second.total, 76);

  const film = (
    await db.query(
      "select public.get_panini_albums_page('', 'FILM', 0, 72) as value"
    )
  ).rows[0].value;
  assert.deepEqual(film.items, [
    { license: "FILM", total: 2, owned: 0, percent: 0 }
  ]);

  const cards = (
    await db.query(
      "select public.get_panini_album_cards_page('FILM','Film','FILM',false,0,24) as value"
    )
  ).rows[0].value;
  assert.equal(cards.total, 2);
  assert.equal(cards.items.length, 2);
  assert.ok(cards.items.every(card => card.owned === false));

  const ownedOnly = (
    await db.query(
      "select public.get_panini_album_cards_page('Licence 001','','',true,0,24) as value"
    )
  ).rows[0].value;
  assert.equal(ownedOnly.total, 1);
  assert.equal(ownedOnly.items[0].owned, true);

  await db.exec("reset role");
  for (const role of ["public", "anon"]) {
    assert.equal(
      (
        await db.query(
          "select has_function_privilege($1,'public.get_panini_albums_page(text,text,integer,integer)','EXECUTE') as allowed",
          [role]
        )
      ).rows[0].allowed,
      false
    );
  }
});
