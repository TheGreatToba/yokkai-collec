import assert from "node:assert/strict";

export async function exerciseGlobalBinders(db) {
  const checks = [];
  const owner = "91000000-0000-4000-8000-000000000001";
  const viewer = "91000000-0000-4000-8000-000000000002";
  const stranger = "91000000-0000-4000-8000-000000000003";
  const ids = [1, 2, 3].map(n => `92000000-0000-4000-8000-00000000000${n}`);
  const value = async (sql, args = []) =>
    (await db.query(sql, args)).rows[0].value;
  await db.exec(`
    insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source)
    select 'binder-alias-'||md5(a.source_license),'ALIAS FIXTURE',a.category,a.source_license,'C','https://example.test/a.png','binder-fixture'
    from public.global_binder_aliases a where not exists(
      select 1 from public.card_franchises l join public.cards c on c.id=l.card_id
      where l.franchise=a.source_license and upper(btrim(c.categorie))=a.category);
    insert into auth.users(id,raw_user_meta_data) values
      ('${owner}','{"pseudo":"BinderOwnerFixture"}'),('${viewer}','{"pseudo":"BinderViewerFixture"}'),('${stranger}','{"pseudo":"BinderStrangerFixture"}');
    insert into public.cards(id,source_id,nom,categorie,franchise,franchise_romaji,rarete_base,image_url,description,source) values
      ('${ids[0]}','global-a','GLOBAL FIXTURE A','ANIME/MANGA','Global Fixture Original','Original title A','C','https://example.test/a.png','Original description A','global-fixture'),
      ('${ids[1]}','global-b','GLOBAL FIXTURE B','ANIME/MANGA','Global Fixture Sequel','Original title B','SR','https://example.test/b.png','Original description B','global-fixture'),
      ('${ids[2]}','global-c','GLOBAL FIXTURE C','ANIME/MANGA','Global Fixture Original','Original title C','C','https://example.test/c.png','Original description C','global-fixture');
    insert into public.card_franchises values ('${ids[0]}','Global Fixture Sequel',1),('${ids[0]}','Global Outside',2);
    insert into public.global_binder_aliases(category,source_license,binder_license,evidence) values
      ('ANIME/MANGA','Global Fixture Original','Global Fixture','synthetic fixture'),
      ('ANIME/MANGA','Global Fixture Sequel','Global Fixture','synthetic fixture');
    update public.global_binder_settings set manifest_sha256=public.global_binder_mapping_sha256() where singleton;
    insert into public.folders(id,user_id,nom) values ('93000000-0000-4000-8000-000000000001','${owner}','Fixture folder');
    insert into public.user_cards(user_id,card_id,rarity,is_shiny,is_locked,folder_id) values
      ('${owner}','${ids[0]}','LR',true,true,'93000000-0000-4000-8000-000000000001'),
      ('${owner}','${ids[0]}','C',false,false,null);
    insert into public.panini_album_favorites(user_id,license) values ('${owner}','Global Fixture Original'),('${owner}','Global Fixture Sequel');
    update public.user_profiles set is_public=false,profile_widgets='[{"category":"ANIME/MANGA","entries":["Global Fixture Sequel","Global Fixture Original"]}]' where user_id='${owner}';
  `);
  const fingerprint = async tables => {
    const result = {};
    for (const table of tables)
      result[table] = await value(
        `select md5(coalesce(string_agg(row_to_json(t)::text,E'\n' order by row_to_json(t)::text),'')) as value from public.${table} t`
      );
    return result;
  };
  const tables = [
    "cards",
    "card_franchises",
    "card_categories",
    "user_cards",
    "folders",
    "wishlists",
    "panini_album_favorites",
    "user_profiles",
    "auctions",
    "trade_offers",
    "card_shares"
  ];
  const before = await fingerprint(tables);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner
  ]);
  await db.exec("set role authenticated");
  const albums = query =>
    value("select public.get_panini_albums_page($1,'',0,72,false) as value", [
      query
    ]);
  assert.equal((await albums("Global Fixture")).items.length, 2);
  await db.exec(
    "reset role; select public.validate_global_binder_mapping(); update public.global_binder_settings set enabled=true,preferences_global=true where singleton;"
  );
  assert.deepEqual(await fingerprint(tables), before);
  checks.push(
    "PASS activation preserves complete rows across 11 catalogue/player tables"
  );
  await db.exec("set role authenticated");
  const grouped = await albums("Global Fixture");
  await assert.rejects(
    db.exec(
      `insert into public.panini_album_favorites(user_id,license) values('${owner}','Global Outside')`
    ),
    /BINDER_REFRESH_REQUIRED/
  );
  await assert.rejects(
    db.exec(
      `delete from public.panini_album_favorites where user_id='${owner}' and license='Global Fixture Original'`
    ),
    /BINDER_REFRESH_REQUIRED/
  );
  checks.push(
    "PASS stale browser direct favorite writes fail explicitly without partial preference changes"
  );
  assert.equal(grouped.total, 1);
  assert.deepEqual(grouped.items, [
    {
      license: "Global Fixture",
      total: 3,
      owned: 1,
      percent: 33,
      favorite: true
    }
  ]);
  assert.deepEqual(
    (await albums("Global Fixture Sequel")).items,
    grouped.items
  );
  const cards = await value(
    "select public.get_panini_album_cards_page('Global Fixture Sequel','','',false,0,60) as value"
  );
  assert.equal(cards.total, 3);
  assert.equal(new Set(cards.items.map(card => card.id)).size, 3);
  assert.equal(
    cards.items.find(card => card.id === ids[1]).anime,
    "Global Fixture Sequel"
  );
  assert.equal(
    (
      await value(
        "select public.get_panini_album_cards_page('Global Fixture','','',true,0,60) as value"
      )
    ).total,
    1
  );
  assert.equal(
    (
      await value(
        "select public.get_panini_album_cards_page('Global Fixture','','',false,0,60,'SR') as value"
      )
    ).total,
    1
  );
  assert.equal(
    (
      await value(
        "select public.get_panini_album_cards_page('Global Fixture','','VIDEO GAMES',false,0,60) as value"
      )
    ).total,
    0
  );
  const first = await value(
    "select public.get_panini_album_cards_page('Global Fixture','','',false,0,1) as value"
  );
  const next = await value(
    "select public.get_panini_album_cards_page('Global Fixture','','',false,1,1) as value"
  );
  assert.equal(first.total, 3);
  assert.equal(next.total, 3);
  assert.notEqual(first.items[0].id, next.items[0].id);
  assert.equal((await albums("Global Outside")).items[0].total, 1);
  checks.push(
    "PASS source-name search, pagination, category, rarity, owned progress, deduplication and outside secondary license"
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    viewer
  ]);
  await assert.rejects(
    value(
      "select public.get_friend_panini_albums_page($1,'Global Fixture','',0,72) as value",
      [owner]
    ),
    /PROFILE_PRIVATE/
  );
  await db.exec(
    `reset role; insert into public.friendships(user_id,friend_id,status) values ('${viewer}','${owner}','accepted'); set role authenticated;`
  );
  assert.deepEqual(
    (
      await value(
        "select public.get_friend_panini_albums_page($1,'Global Fixture','',0,72) as value",
        [owner]
      )
    ).items,
    grouped.items
  );
  assert.equal(
    (
      await value(
        "select public.get_friend_panini_album_cards_page($1,'Global Fixture','','',true,0,60,'C') as value",
        [owner]
      )
    ).total,
    1
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    stranger
  ]);
  await assert.rejects(
    value(
      "select public.get_friend_panini_album_cards_page($1,'Global Fixture','','',false,0,60) as value",
      [owner]
    ),
    /PROFILE_PRIVATE/
  );
  checks.push(
    "PASS friend-only/private binder access and both card RPC overloads"
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner
  ]);
  assert.equal(
    (
      await value(
        "select public.get_profile_widget_licenses('ANIME/MANGA','Global Fixture Sequel',0,72) as value"
      )
    ).items[0],
    "Global Fixture"
  );
  const details = await value(
    "select public.get_profile_details(null) as value"
  );
  assert.deepEqual(details.widgets, [
    { category: "ANIME/MANGA", entries: ["Global Fixture"] }
  ]);
  assert.equal(
    details.favoriteAlbums.filter(album => album.license === "Global Fixture")
      .length,
    1
  );
  const widgets = [
    { category: "ANIME/MANGA", entries: ["Global Outside", "Global Fixture"] }
  ];
  assert.deepEqual(
    await value("select public.update_profile_widgets($1::jsonb) as value", [
      JSON.stringify(widgets)
    ]),
    widgets
  );
  await assert.rejects(
    value("select public.update_profile_widgets($1::jsonb) as value", [
      JSON.stringify([
        {
          category: "ANIME/MANGA",
          entries: ["Global Fixture", "Global Fixture"]
        }
      ])
    ]),
    /WIDGETS_INVALID/
  );
  await value(
    "select public.set_global_binder_favorite('Global Fixture',false) as value"
  );
  assert.equal((await albums("Global Fixture")).items[0].favorite, false);
  await value(
    "select public.set_global_binder_favorite('Global Fixture',true) as value"
  );
  await value(
    "select public.set_global_binder_favorite('Global Fixture',true) as value"
  );
  assert.equal((await albums("Global Fixture")).items[0].favorite, true);
  await db.exec("reset role");
  assert.equal(
    await value(
      `select count(*)::integer as value from public.panini_album_favorites where user_id='${owner}' and license like 'Global Fixture%'`
    ),
    2
  );
  const storedWidgets = await value(
    `select profile_widgets as value from public.user_profiles where user_id='${owner}'`
  );
  assert.deepEqual(storedWidgets[0].entries, [
    "Global Outside",
    "Global Fixture Original",
    "Global Fixture Sequel"
  ]);
  checks.push(
    "PASS favorite desired state/idempotence, old alias removal, profile widgets/order and source preference retention"
  );
  const immutableTables = tables.filter(
    table => !["user_profiles", "panini_album_favorites"].includes(table)
  );
  const afterActions = await fingerprint(immutableTables);
  for (const table of immutableTables)
    assert.equal(afterActions[table], before[table], table);
  await db.exec(
    "begin; update public.global_binder_settings set enabled=false where singleton; rollback;"
  );
  assert.equal(
    await value("select enabled as value from public.global_binder_settings"),
    true
  );
  await db.exec(
    "update public.global_binder_settings set enabled=false where singleton"
  );
  await db.exec("set role authenticated");
  const legacy = await albums("Global Fixture");
  assert.equal(legacy.items.length, 2);
  assert.ok(legacy.items.every(album => album.favorite));
  const rollbackDetails = await value(
    "select public.get_profile_details(null) as value"
  );
  assert.deepEqual(rollbackDetails.widgets, storedWidgets);
  await value("select public.update_profile_widgets($1::jsonb) as value", [
    JSON.stringify(storedWidgets)
  ]);
  const large = await value(
    "select public.update_profile_widgets($1::jsonb) as value",
    [JSON.stringify([{ category: "ANIME/MANGA", entries: ["Gundam"] }])]
  );
  assert.ok(
    large[0].entries.length > 12,
    "rollback retains every source of a large franchise"
  );
  assert.deepEqual(
    await value("select public.update_profile_widgets($1::jsonb) as value", [
      JSON.stringify(large)
    ]),
    large
  );
  await db.exec("reset role");
  assert.deepEqual(await fingerprint(immutableTables), afterActions);
  checks.push(
    "PASS failed transaction rollback and presentation rollback preserve post-activation preferences and every source row"
  );
  await db.exec("set role authenticated");
  await assert.rejects(
    db.exec("update public.global_binder_settings set enabled=true"),
    /permission denied/
  );
  await assert.rejects(
    db.exec("select public.validate_global_binder_mapping()"),
    /permission denied/
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.exec("select public.set_global_binder_favorite('Global Fixture',true)"),
    /permission denied/
  );
  await assert.rejects(
    db.exec("select * from public.global_binder_favorites"),
    /permission denied/
  );
  await db.exec("reset role");
  await db.exec(
    "insert into public.global_binder_aliases values('ANIME/MANGA','Global Fixture','Global Chained','synthetic invalid chain')"
  );
  await assert.rejects(
    db.exec("select public.validate_global_binder_mapping()"),
    /GLOBAL_BINDER_CHAIN/
  );
  await db.exec(
    "delete from public.global_binder_aliases where source_license='Global Fixture'"
  );
  await db.exec(
    "insert into public.global_binder_aliases values('ANIME/MANGA','Unregistered Fixture','Unknown Fixture','synthetic missing source')"
  );
  await assert.rejects(
    db.exec("select public.validate_global_binder_mapping()"),
    /GLOBAL_BINDER_UNKNOWN_SOURCE/
  );
  await db.exec(
    "delete from public.global_binder_aliases where source_license='Unregistered Fixture'"
  );
  await db.exec(
    "update public.global_binder_aliases set evidence='unreviewed change' where source_license='Global Fixture Sequel'"
  );
  await assert.rejects(
    db.exec(
      "update public.global_binder_settings set enabled=true,preferences_global=true where singleton"
    ),
    /GLOBAL_BINDER_MANIFEST_MISMATCH/
  );
  await db.exec(
    "update public.global_binder_aliases set evidence='synthetic fixture' where source_license='Global Fixture Sequel'"
  );
  await db.exec(
    "insert into public.cards(source_id,nom,categorie,franchise,rarete_base,image_url,source) values('category-collision','COLLISION','VIDEO GAMES','Global Fixture Sequel','C','https://example.test/collision.png','global-fixture')"
  );
  await assert.rejects(
    db.exec("select public.validate_global_binder_mapping()"),
    /GLOBAL_BINDER_CATEGORY_COLLISION/
  );
  await db.exec(
    "delete from public.cards where source='global-fixture' and source_id='category-collision'"
  );
  checks.push(
    "PASS explicit grants, no player activation, anonymous preference isolation and fail-closed chain validation"
  );
  return checks;
}
