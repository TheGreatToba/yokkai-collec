import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("l'administration repose sur un rôle serveur et une fonction limitée à l'utilisateur courant", async () => {
  const migration = await read("supabase/migrations/20261003000000_admin_card_management.sql");
  assert.match(migration, /create table public\.admin_users/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.admin_users[\s\S]+authenticated/i);
  assert.match(migration, /auth\.uid\(\)[\s\S]+public\.admin_users/i);
  assert.match(migration, /grant execute on function public\.is_current_user_admin\(\) to authenticated/i);
});

test("chaque mutation de carte réautorise l'admin côté serveur et journalise l'action", async () => {
  const actions = await read("app/admin/cards/actions.ts");
  for (const name of ["createCardAction", "importCardsAction", "updateCardAction", "deleteCardAction"]) {
    const start = actions.indexOf(`function ${name}`);
    assert.notEqual(start, -1, `${name} absente`);
    const next = actions.indexOf("export async function", start + 20);
    const body = actions.slice(start, next === -1 ? undefined : next);
    assert.match(body, /requireAdminAction\(\)/, `${name} doit revérifier le rôle`);
  }
  assert.match(actions, /admin_audit_logs/g);
});

test("l'application admin utilise la session authentifiée sans clé service-role", async () => {
  const actions = await read("app/admin/cards/actions.ts");
  const page = await read("app/admin/cards/page.tsx");
  const ui = await read("app/admin/cards/admin-card-manager.tsx");
  assert.doesNotMatch(actions + page + ui, /SERVICE_ROLE|SECRET_KEY|createAdminClient/);
  const migration = await read("supabase/migrations/20261003000000_admin_card_management.sql");
  assert.match(migration, /cards_admin_update/);
  assert.match(migration, /card_images_admin_insert/);
});

test("un CSV admin sans source_id bascule en source manuelle pour obtenir un identifiant stable", async () => {
  const actions = await read("app/admin/cards/actions.ts");
  assert.match(actions, /source:\s*sourceId\s*\?\s*\(row\.source \|\| "manual"\)\s*:\s*"manual"/);
  assert.match(actions, /normalize\("NFD"\)/);
  assert.match(actions, /row\.franchise \?\? row\.licence/);
  assert.match(actions, /row\.image_url \?\? row\.image \?\? row\.image_source/);
});

test("les erreurs d'import CSV affichent le nom de la carte avec sa ligne", async () => {
  const actions = await read("app/admin/cards/actions.ts");
  const importStart = actions.indexOf("function importCardsAction");
  const updateStart = actions.indexOf("function updateCardAction");
  const csvImport = actions.slice(importStart, updateStart);
  assert.match(csvImport, /rows\[failure\.record - 1\]\?\.nom\.trim\(\)/);
  assert.match(csvImport, /Carte « \$\{cardName\} »/);
  assert.match(csvImport, /\(ligne \$\{failure\.record\}\): \$\{failure\.message\}/);
  assert.match(csvImport, /Carte sans nom/);
});

test("le menu Admin dépend du rôle et Succès reste dans le menu profil", async () => {
  const topbar = await read("components/topbar.tsx");
  const adminLink = topbar.indexOf('href="/admin/cards"');
  const achievementsLink = topbar.indexOf('href="/succes"');
  assert.ok(adminLink > 0 && achievementsLink > adminLink);
  assert.equal((topbar.match(/href="\/succes"/g) ?? []).length, 1);
  assert.match(topbar.slice(adminLink - 100, adminLink), /isAdmin/);
  const hook = await read("hooks/use-is-admin.ts");
  assert.match(hook, /rpc\("is_current_user_admin"\)/);
});

test("une carte existante accepte une nouvelle image par URL ou fichier", async () => {
  const actions = await read("app/admin/cards/actions.ts");
  const ui = await read("app/admin/cards/admin-card-manager.tsx");
  const updateStart = actions.indexOf("function updateCardAction");
  const deleteStart = actions.indexOf("function deleteCardAction");
  const update = actions.slice(updateStart, deleteStart);
  assert.match(update, /form\.get\("image_file"\)/);
  assert.match(update, /imageForCard\(form, imageCard\)/);
  assert.match(update, /patch\.image_url/);
  assert.match(ui, /Nouvelle URL d’image/);
  assert.match(ui, /nouveau fichier/);
  assert.match(ui, />Saga</);
});

test("le remplacement d'une image admin utilise une nouvelle URL pour contourner les caches", async () => {
  const actions = await read("app/admin/cards/actions.ts");
  const updateStart = actions.indexOf("function updateCardAction");
  const deleteStart = actions.indexOf("function deleteCardAction");
  const update = actions.slice(updateStart, deleteStart);
  assert.match(actions, /import \{ randomUUID \} from "node:crypto"/);
  assert.match(update, /`\$\{imagePath\(imageCard\)\}-\$\{randomUUID\(\)\}`/);
  assert.match(update, /patch\.image_url = client\.storage\.from\("card-images"\)\.getPublicUrl\(path\)\.data\.publicUrl/);
});

test("la suppression admin demande une confirmation explicite", async () => {
  const ui = await read("app/admin/cards/admin-card-manager.tsx");
  assert.match(ui, /const \[deleteConfirm, setDeleteConfirm\] = useState\(false\)/);
  assert.match(ui, /type="button" onClick=\{\(\)=>setDeleteConfirm\(true\)\}>Supprimer/);
  assert.match(ui, /<Modal open=\{deleteConfirm\}[\s\S]*?title="Supprimer cette carte \?"/);
  assert.match(ui, /Cette action est irréversible\./);
  assert.match(ui, /<form action=\{deleteAction\}[^>]+>/);
  assert.match(ui, /type="submit">\{deleting \? "Suppression…" : "Confirmer la suppression"\}/);
});

test("la licence est facultative lors de l’ajout et de la modification d’une carte", async () => {
  const actions = await read("app/admin/cards/actions.ts");
  const ui = await read("app/admin/cards/admin-card-manager.tsx");
  assert.doesNotMatch(ui, /name="franchise" required/);
  assert.equal(ui.match(/Licence \(facultatif\)/g)?.length, 2);
  assert.match(actions, /if \(!patch\.nom \|\| !patch\.categorie\)/);
  assert.doesNotMatch(actions, /!patch\.franchise/);
});

test("la resynchronisation admin peut cibler les catégories existantes", async () => {
  const migration = await read("supabase/migrations/20261003000004_admin_card_categories_select.sql");
  assert.match(migration, /grant select on table public\.card_categories to authenticated/i);
  const adminMigration = await read("supabase/migrations/20261003000000_admin_card_management.sql");
  assert.match(adminMigration, /card_categories_admin_all[\s\S]+is_current_user_admin/i);
});

test("un remplacement d’image admin peut relire l’objet nécessaire à l’upsert", async () => {
  const migration = await read("supabase/migrations/20261003000005_admin_card_images_select.sql");
  assert.match(migration, /create policy card_images_admin_select/i);
  assert.match(migration, /on storage\.objects for select to authenticated/i);
  assert.match(migration, /bucket_id = 'card-images'[\s\S]+is_current_user_admin/i);
});

test("un admin peut rechercher une carte par son nom dans tout le catalogue", async () => {
  const page = await read("app/admin/cards/page.tsx");
  assert.match(page, /searchParams:\s*Promise<\{ q\?: string; category\?: string \}>/);
  assert.match(page, /nom\.ilike\.\$\{term\},franchise\.ilike\.\$\{term\}/);
  assert.match(page, /name="q"/);
  assert.match(page, /Rechercher une carte du catalogue/);
});

test("la recherche admin retourne toutes les cartes d'une licence", async () => {
  const page = await read("app/admin/cards/page.tsx");
  const manager = await read("app/admin/cards/admin-card-manager.tsx");
  assert.match(page, /franchise\.ilike\.\$\{term\}/);
  assert.match(page, /ADMIN_SEARCH_PAGE_SIZE = 1000/);
  assert.match(page, /offset \+= ADMIN_SEARCH_PAGE_SIZE/);
  assert.match(page, /Nom de la carte ou de la licence/);
  assert.match(page, /V Cyberpunk/);
  assert.match(manager, /ce nom ou cette licence/);
});

test("la recherche admin combine le personnage et sa licence", async () => {
  const page = await read("app/admin/cards/page.tsx");
  assert.match(page, /searchQuery\.split\(\/\\s\+\/\)\.filter\(Boolean\)/);
  assert.match(page, /for \(const searchTerm of searchTerms\)/);
  assert.match(page, /const term = quotedLike\(searchTerm\)/);
  assert.match(page, /cardsQuery = cardsQuery\.or\(`nom\.ilike\.\$\{term\},franchise\.ilike\.\$\{term\}`\)/);
});

test("un admin peut filtrer les cartes avec une liste de catégories", async () => {
  const page = await read("app/admin/cards/page.tsx");
  const migration = await read("supabase/migrations/20261003000006_admin_card_category_filter.sql");
  assert.match(page, /searchParams:\s*Promise<\{ q\?: string; category\?: string \}>/);
  assert.match(page, /rpc\("list_admin_card_categories"\)/);
  assert.match(page, /name="category"/);
  assert.match(page, /Toutes les catégories/);
  assert.match(page, /sm:grid-cols-\[minmax\(0,3fr\)_minmax\(14rem,2fr\)_auto_auto\]/);
  assert.match(page, /id="admin-card-category"[^>]+w-full min-w-0/);
  assert.match(page, /aria-label="Nom de la carte ou de la licence"[^>]+w-full min-w-0/);
  assert.match(page, /cardsQuery\.eq\("categorie", selectedCategory\)/);
  assert.doesNotMatch(page, /name="q"[^>]+required/);
  assert.match(migration, /select distinct categorie as category/i);
  assert.match(migration, /if not public\.is_current_user_admin\(\)/i);
});

test("la migration NBA range les cartes dans SPORT avec la licence NBA", async () => {
  const migration = await read("supabase/migrations/20261004000000_migrate_nba_cards_to_sport.sql");
  const nbaCsv = await read("data/nba_clean.csv");

  assert.match(migration, /upper\(btrim\(categorie\)\) = 'NBA'/i);
  assert.match(migration, /set categorie = 'SPORT',[\s\S]+franchise = 'NBA'/i);
  assert.match(migration, /insert into public\.card_categories[\s\S]+select card_id, 'SPORT'/i);
  assert.match(migration, /delete from public\.card_categories[\s\S]+upper\(btrim\(categorie\)\) = 'NBA'/i);
  assert.doesNotMatch(nbaCsv, /^,[^,\r\n]+,NBA,/m);
  assert.match(nbaCsv, /,SPORT,NBA,,/);

  const db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    create table public.cards (id uuid primary key, categorie text not null, franchise text);
    create table public.card_categories (
      card_id uuid not null references public.cards(id) on delete cascade,
      categorie text not null,
      primary key (card_id, categorie)
    );
    insert into public.cards (id, categorie, franchise) values
      ('00000000-0000-0000-0000-000000000001', ' NBA ', null),
      ('00000000-0000-0000-0000-000000000002', 'AUTRE', 'Ancienne licence'),
      ('00000000-0000-0000-0000-000000000003', 'MUSIQUE', null);
    insert into public.card_categories (card_id, categorie) values
      ('00000000-0000-0000-0000-000000000001', 'NBA'),
      ('00000000-0000-0000-0000-000000000001', 'SPORT'),
      ('00000000-0000-0000-0000-000000000002', 'nba'),
      ('00000000-0000-0000-0000-000000000003', 'MUSIQUE');
  `);
  await db.exec(migration);

  const cards = await db.query("select id, categorie, franchise from public.cards order by id");
  assert.deepEqual(cards.rows, [
    { id: "00000000-0000-0000-0000-000000000001", categorie: "SPORT", franchise: "NBA" },
    { id: "00000000-0000-0000-0000-000000000002", categorie: "SPORT", franchise: "NBA" },
    { id: "00000000-0000-0000-0000-000000000003", categorie: "MUSIQUE", franchise: null },
  ]);
  const categories = await db.query("select card_id, categorie from public.card_categories order by card_id, categorie");
  assert.deepEqual(categories.rows, [
    { card_id: "00000000-0000-0000-0000-000000000001", categorie: "SPORT" },
    { card_id: "00000000-0000-0000-0000-000000000002", categorie: "SPORT" },
    { card_id: "00000000-0000-0000-0000-000000000003", categorie: "MUSIQUE" },
  ]);
  await db.close();
});

test("les catégories existantes et futures sont normalisées en majuscules", async () => {
  const migration = await read("supabase/migrations/20261004000001_uppercase_card_categories.sql");
  const db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    create table public.cards (id uuid primary key, categorie text not null, franchise text);
    create table public.card_categories (
      card_id uuid not null references public.cards(id) on delete cascade,
      categorie text not null,
      primary key (card_id, categorie)
    );
    insert into public.cards (id, categorie) values
      ('00000000-0000-0000-0000-000000000001', 'Anime/Manga'),
      ('00000000-0000-0000-0000-000000000002', ' sport ');
    insert into public.card_categories (card_id, categorie) values
      ('00000000-0000-0000-0000-000000000001', 'Anime/Manga'),
      ('00000000-0000-0000-0000-000000000001', 'ANIME/MANGA'),
      ('00000000-0000-0000-0000-000000000002', ' sport ');
  `);
  await db.exec(migration);

  assert.deepEqual((await db.query("select categorie from public.cards order by id")).rows, [
    { categorie: "ANIME/MANGA" },
    { categorie: "SPORT" },
  ]);
  assert.deepEqual((await db.query("select card_id, categorie from public.card_categories order by card_id")).rows, [
    { card_id: "00000000-0000-0000-0000-000000000001", categorie: "ANIME/MANGA" },
    { card_id: "00000000-0000-0000-0000-000000000002", categorie: "SPORT" },
  ]);

  await db.exec(`
    insert into public.cards (id, categorie) values
      ('00000000-0000-0000-0000-000000000003', ' nouvelle catégorie ');
    insert into public.card_categories (card_id, categorie) values
      ('00000000-0000-0000-0000-000000000003', ' nouvelle catégorie ');
  `);
  assert.deepEqual((await db.query("select categorie from public.cards where id='00000000-0000-0000-0000-000000000003'")).rows, [
    { categorie: "NOUVELLE CATÉGORIE" },
  ]);
  assert.deepEqual((await db.query("select categorie from public.card_categories where card_id='00000000-0000-0000-0000-000000000003'")).rows, [
    { categorie: "NOUVELLE CATÉGORIE" },
  ]);
  await db.close();
});

test("la catégorie ARTISTE est renommée ARTIST et reste normalisée à l'import", async () => {
  const uppercaseMigration = await read("supabase/migrations/20261004000001_uppercase_card_categories.sql");
  const artistMigration = await read("supabase/migrations/20261004000002_rename_artiste_category.sql");
  const db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    create table public.cards (id uuid primary key, categorie text not null, franchise text);
    create table public.card_categories (
      card_id uuid not null references public.cards(id) on delete cascade,
      categorie text not null,
      primary key (card_id, categorie)
    );
    insert into public.cards (id, categorie) values
      ('00000000-0000-0000-0000-000000000001', 'Artiste');
    insert into public.card_categories (card_id, categorie) values
      ('00000000-0000-0000-0000-000000000001', 'Artiste');
  `);
  await db.exec(uppercaseMigration);
  await db.exec(artistMigration);

  assert.deepEqual((await db.query("select categorie from public.cards order by id")).rows, [
    { categorie: "ARTIST" },
  ]);
  assert.deepEqual((await db.query("select categorie from public.card_categories order by card_id")).rows, [
    { categorie: "ARTIST" },
  ]);

  await db.exec(`
    insert into public.cards (id, categorie) values
      ('00000000-0000-0000-0000-000000000002', ' artiste ');
  `);
  assert.deepEqual((await db.query("select categorie from public.cards where id='00000000-0000-0000-0000-000000000002'")).rows, [
    { categorie: "ARTIST" },
  ]);
  await db.close();
});

test("la catégorie VIDEO GAME est renommée VIDEO GAMES et reste normalisée à l'import", async () => {
  const migration = await read("supabase/migrations/20261004000006_rename_video_games_category.sql");
  assert.match(migration, /select card_id, 'VIDEO GAMES'/i);
  assert.match(migration, /where upper\(btrim\(categorie\)\) = 'VIDEO GAME'/i);
  assert.match(migration, /set categorie = 'VIDEO GAMES'/i);
  assert.match(migration, /when 'VIDEO GAME' then 'VIDEO GAMES'/i);
});

test("les noms de cartes existants et futurs sont normalisés en majuscules", async () => {
  const migration = await read("supabase/migrations/20261004000003_uppercase_card_names.sql");
  const db = new PGlite();
  await db.exec(`
    create schema if not exists public;
    create table public.cards (
      id uuid primary key,
      nom text not null,
      source text not null,
      source_id text not null,
      unique (source, source_id)
    );
    insert into public.cards (id, nom, source, source_id) values
      ('00000000-0000-0000-0000-000000000001', 'Satoru Gojō', 'test', '1'),
      ('00000000-0000-0000-0000-000000000002', ' déjà en MAJUSCULE ', 'test', '2');
  `);
  await db.exec(migration);

  assert.deepEqual((await db.query("select nom from public.cards order by id")).rows, [
    { nom: "SATORU GOJŌ" },
    { nom: "DÉJÀ EN MAJUSCULE" },
  ]);

  await db.exec(`
    insert into public.cards (id, nom, source, source_id) values
      ('00000000-0000-0000-0000-000000000003', ' nouvelle carte ', 'test', '3');
    update public.cards set nom = 'nom modifié' where id = '00000000-0000-0000-0000-000000000003';
  `);
  assert.deepEqual((await db.query("select nom from public.cards where id='00000000-0000-0000-0000-000000000003'")).rows, [
    { nom: "NOM MODIFIÉ" },
  ]);
  await db.close();
});
