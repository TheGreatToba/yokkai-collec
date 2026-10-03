import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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

test("le menu Admin suit Succès et dépend du rôle admin", async () => {
  const topbar = await read("components/topbar.tsx");
  const adminLink = topbar.indexOf('href="/admin/cards"');
  const achievementsLink = topbar.indexOf('href="/succes"');
  assert.ok(achievementsLink > 0 && achievementsLink < adminLink);
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

test("un admin peut rechercher une carte par son nom dans tout le catalogue", async () => {
  const page = await read("app/admin/cards/page.tsx");
  assert.match(page, /searchParams:\s*Promise<\{ q\?: string; category\?: string \}>/);
  assert.match(page, /\.ilike\("nom", `%\$\{searchQuery\}%`\)/);
  assert.match(page, /name="q"/);
  assert.match(page, /Rechercher une carte du catalogue/);
});

test("un admin peut filtrer les cartes avec une liste de catégories", async () => {
  const page = await read("app/admin/cards/page.tsx");
  const migration = await read("supabase/migrations/20261003000006_admin_card_category_filter.sql");
  assert.match(page, /searchParams:\s*Promise<\{ q\?: string; category\?: string \}>/);
  assert.match(page, /rpc\("list_admin_card_categories"\)/);
  assert.match(page, /name="category"/);
  assert.match(page, /Toutes les catégories/);
  assert.match(page, /id="admin-card-category"[^>]+sm:w-64 sm:flex-none/);
  assert.match(page, /aria-label="Nom de la carte"[^>]+min-w-0 flex-1/);
  assert.match(page, /cardsQuery\.eq\("categorie", selectedCategory\)/);
  assert.doesNotMatch(page, /name="q"[^>]+required/);
  assert.match(migration, /select distinct categorie as category/i);
  assert.match(migration, /if not public\.is_current_user_admin\(\)/i);
});
