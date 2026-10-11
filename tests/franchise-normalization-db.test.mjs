import assert from "node:assert/strict";
import test from "node:test";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

const player = "71000000-0000-4000-8000-000000000001";

test("les saisons, cours et parties numerotees partagent la meme licence", async t => {
  const { db } = await replayMigrations();
  t.after(() => db.close());

  const examples = [
    ["Kingdom Season 3", "Kingdom"],
    ["Attack on Titan Season 3 Part 2", "Attack on Titan"],
    ["SPY x FAMILY Cour 2", "SPY x FAMILY"],
    ["HAIKYU!! 2nd Season", "HAIKYU!!"],
    ["Fruits Basket The Final Season", "Fruits Basket"],
    ["KENGAN ASHURA Season 2 Part.2", "KENGAN ASHURA"],
    ["Persona 3", "Persona 3"],
    [
      "Agents of the Four Seasons: Dance of Spring",
      "Agents of the Four Seasons: Dance of Spring"
    ]
  ];

  for (const [source, expected] of examples) {
    const result = (
      await db.query("select public.normalize_card_franchise($1) as value", [
        source
      ])
    ).rows[0].value;
    assert.equal(result, expected, source);
  }

  await db.query(
    "insert into auth.users(id,raw_user_meta_data) values ($1,$2::jsonb)",
    [player, JSON.stringify({ pseudo: "GroupedLicenses" })]
  );
  await db.exec("set role service_role");
  await db.exec(`
    insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    values
      ('kingdom-base','Kingdom Base','ANIME/MANGA','Kingdom','C','https://example.test/base.png','license-test'),
      ('kingdom-s3','Kingdom S3','ANIME/MANGA','Kingdom Season 3','R','https://example.test/s3.png','license-test'),
      ('kingdom-s4','Kingdom S4','ANIME/MANGA','Kingdom Season 4 Part 2','SR','https://example.test/s4.png','license-test');
  `);
  await db.exec("reset role");

  assert.deepEqual(
    (
      await db.query(
        "select distinct franchise from public.cards where source='license-test' order by franchise"
      )
    ).rows,
    [{ franchise: "Kingdom" }]
  );

  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    player
  ]);

  const albums = (
    await db.query(
      "select public.get_panini_albums_page('Kingdom', '', 0, 72) as value"
    )
  ).rows[0].value;
  assert.equal(albums.items.length, 1);
  assert.deepEqual(albums.items[0], {
    license: "Kingdom",
    total: 3,
    owned: 0,
    percent: 0
  });

  const cards = (
    await db.query(
      "select public.get_panini_album_cards_page('Kingdom','','',false,0,24) as value"
    )
  ).rows[0].value;
  assert.equal(cards.total, 3);
  assert.ok(cards.items.every(card => card.anime === "Kingdom"));
});
