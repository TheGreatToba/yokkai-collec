# Collaboration — workflow à deux sur Yokkai Collec'

Deux développeurs travaillent en parallèle sur ce repo, chacun avec ses propres agents de code
(Claude Code, Codex…). Ces règles valent pour les humains **et** pour les agents.

## 0. Prérequis : installer le hook git (une fois, après le clone)

```bash
npm run setup
```

Ça active le hook `.githooks/pre-push`, qui refuse tout push direct sur `master`. Vérifier :
`git config core.hooksPath` doit afficher `.githooks`.

> **État actuel : `master` n'est PAS protégée côté GitHub.** La protection de branche n'est pas
> disponible pour un repo privé sur le plan gratuit. La discipline repose donc uniquement sur :
>
> - le hook pre-push local, que **chaque dev doit installer** (`npm run setup`) ;
> - le respect du workflow PR décrit ci-dessous.
>
> Le hook se contourne avec `git push --no-verify` : ne jamais le faire vers `master`.
> Si le repo passe en GitHub Pro, la protection de branche (« Require a pull request before
> merging ») pourra être activée dans Settings > Branches — ce document sera alors mis à jour.

## 1. Jamais de commit direct sur `master`

Toute tâche part d'une branche créée depuis un `master` à jour :

```bash
git fetch origin
git checkout -b <branche> origin/master
```

On ne pousse jamais sur `master` : on y merge via Pull Request. Rien ne l'empêche côté GitHub
pour l'instant (voir § 0), seul le hook pre-push local le bloque.

## 2. Nom de branche : `<initiales>/<description-courte>`

Exemples : `wz/market-realtime`, `xx/collection-filters`.
On voit d'un coup d'œil sur GitHub qui travaille sur quoi.

## 3. Avant de commencer une tâche

```bash
git status            # rien d'inattendu en local ?
git fetch origin
git branch -r         # branches en cours de l'autre dev
gh pr list            # PR ouvertes (si le CLI GitHub est dispo)
```

Repérer si une branche ou PR ouverte touche les mêmes fichiers que la tâche prévue. En cas de
recoupement : se coordonner sur Discord avant de commencer.

## 4. Merge via Pull Request uniquement

- Jamais de merge local poussé directement sur `master`.
- Ouvrir la PR **dès que le travail est prêt à être relu**, pas en fin de chantier (une PR en
  draft est très bien).
- Remplir le template de PR, en particulier la liste des fichiers/zones touchées et les
  migrations.

## 5. Pousser souvent

Ne pas laisser une branche locale avec beaucoup de commits non poussés. Pousser régulièrement
(`git push -u origin <branche>`) et ouvrir la PR tôt pour limiter la fenêtre de collision.

## 6. Migrations Supabase

- **Une seule personne à la fois** applique des migrations sur le VPS (152.228.141.160).
  Prévenir sur Discord **avant** de le faire.
- Avant d'appliquer une migration, **vérifier l'état réel** de la prod au lieu de le supposer :

  ```sql
  select version, name
  from supabase_migrations.schema_migrations
  order by version desc
  limit 20;
  ```

- Chaque PR indique les migrations qu'elle contient et si elles sont **déjà appliquées** sur le
  VPS ou non.

## 7. Pas d'environnement de test séparé (pour l'instant)

Tout le monde teste contre la **même instance Supabase de prod**. Donc :

- Prudence maximale avec toute action qui crée de vraies données.
- Comptes de test : les nettoyer après usage.
- Vérifications pures en SQL : dans une transaction terminée par `ROLLBACK`.

```sql
begin;
-- vérifications…
rollback;
```
