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

test("la clé service-role reste dans un module server-only", async () => {
  const adminClient = await read("utils/supabase/admin.ts");
  assert.match(adminClient, /^import "server-only";/);
  assert.match(adminClient, /SUPABASE_(?:SECRET_KEY|SERVICE_ROLE_KEY)/);
  const ui = await read("app/admin/cards/admin-card-manager.tsx");
  assert.doesNotMatch(ui, /SERVICE_ROLE|SECRET_KEY/);
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
  assert.match(page, /searchParams:\s*Promise<\{ q\?: string \}>/);
  assert.match(page, /\.ilike\("nom", `%\$\{searchQuery\}%`\)/);
  assert.match(page, /name="q"/);
  assert.match(page, /Rechercher une carte du catalogue/);
});
