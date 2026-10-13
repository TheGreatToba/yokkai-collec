import assert from "node:assert/strict";
import test from "node:test";
import { replayMigrations } from "../scripts/replay-migrations.mjs";

const player = "71000000-0000-4000-8000-000000000001";

test("les saisons, films, cours et parties numerotees partagent la meme licence", async t => {
  const { db } = await replayMigrations();
  t.after(() => db.close());

  const examples = [
    ["Kingdom Season 3", "Kingdom"],
    ["Attack on Titan Season 3 Part 2", "Attack on Titan"],
    ["SPY x FAMILY Cour 2", "SPY x FAMILY"],
    ["HAIKYU!! 2nd Season", "HAIKYU!!"],
    ["Fruits Basket The Final Season", "Fruits Basket"],
    ["KENGAN ASHURA Season 2 Part.2", "KENGAN ASHURA"],
    ["One Piece Film: Red", "One Piece"],
    ["ONE PIECE: The Movie", "One Piece"],
    ["Naruto Shippuden the Movie: Blood Prison", "Naruto"],
    ["Road to Ninja: Naruto the Movie", "Naruto"],
    ["Boruto: Naruto the Movie", "Naruto"],
    ["Bleach the Movie: Hell Verse", "Bleach"],
    ["Cardcaptor Sakura the Movie 2: The Sealed Card", "Cardcaptor Sakura"],
    ["Girls und Panzer der Film", "Girls und Panzer"],
    ["Fatal Fury: The Motion Picture", "Fatal Fury"],
    ["Persona 3 the Movie: #3 Falling Down", "Persona 3"],
    ["Pokémon the Movie 2000", "Pokémon"],
    ["Pokémon Black 2 White 2: Introduction Special Movie", "Pokémon"],
    ["Appleseed (Movie)", "Appleseed"],
    ["The Quintessential Quintuplets Movie", "The Quintessential Quintuplets"],
    ["Urusei Yatsura Movie 2: Beautiful Dreamer", "Urusei Yatsura"],
    ["Digimon Survive - Opening Movie", "Digimon Survive - Opening Movie"],
    ["PIKMIN Short Movies", "PIKMIN Short Movies"],
    [
      "Walking through the town with a film director",
      "Walking through the town with a film director"
    ],
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
    insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    values
      ('one-piece-base','One Piece Base','ANIME/MANGA','One Piece','C','https://example.test/op-base.png','movie-license-test'),
      ('one-piece-red','One Piece Red','ANIME/MANGA','One Piece Film: Red','R','https://example.test/op-red.png','movie-license-test'),
      ('naruto-base','Naruto Base','ANIME/MANGA','Naruto','C','https://example.test/naruto-base.png','movie-license-test'),
      ('naruto-road','Naruto Road','ANIME/MANGA','Road to Ninja: Naruto the Movie','SR','https://example.test/naruto-road.png','movie-license-test');
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

  assert.deepEqual(
    (
      await db.query(
        "select franchise, count(*)::int as total from public.cards where source='movie-license-test' group by franchise order by franchise"
      )
    ).rows,
    [
      { franchise: "Naruto", total: 2 },
      { franchise: "One Piece", total: 2 }
    ]
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
    percent: 0,
    favorite: false
  });

  const cards = (
    await db.query(
      "select public.get_panini_album_cards_page('Kingdom','','',false,0,24) as value"
    )
  ).rows[0].value;
  assert.equal(cards.total, 3);
  assert.ok(cards.items.every(card => card.anime === "Kingdom"));
});
