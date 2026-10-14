# Collaboration — workflow à deux sur Yokkai Collec'

Deux développeurs travaillent en parallèle sur ce repo, chacun avec ses propres agents de code
(Claude Code, Codex…). Ces règles valent pour les humains **et** pour les agents.

## 0. Prérequis : installer le hook git (une fois, après le clone)

```bash
npm run setup
```

Ça active les hooks `.githooks/pre-commit` (formatage des fichiers indexés) et `.githooks/pre-push` (refus des pushes directs sur `master`). Le premier
`npm install` le fait aussi automatiquement (script `prepare`) ; `npm run setup` reste utile si
les dépendances étaient déjà installées. Vérifier :
`git config core.hooksPath` doit afficher `.githooks`.

> **État actuel : le dépôt est public et la CI GitHub Actions est automatique.** Une Pull Request
> vers `master` déclenche les contrôles complets ; un push sur `master` les rejoue après le merge.
> La protection de branche doit être configurée côté GitHub pour rendre ces contrôles obligatoires.

Ne jamais utiliser `--no-verify`, pour les humains comme pour les agents. Lancer `npm run format` avant tout commit. Le hook utilise Prettier déjà installé, respecte `.prettierignore`, réindexe uniquement le contenu staged et préserve les modifications non indexées et les fichiers non suivis.

> La protection de branche (« Require a pull request before merging » et contrôles requis) est
> disponible pour ce dépôt public et doit rester activée dans les paramètres GitHub.

Le hook pre-push et la CI sont deux garde-fous distincts : le hook local bloque un push direct sur
`master`, tandis que la CI vérifie le code d'une PR et surveille aussi les pushes sur `master`.

## 1. Jamais de commit direct sur `master`

Toute tâche part d'une branche créée depuis un `master` à jour :

```bash
git fetch origin
git checkout -b <branche> origin/master
```

On ne pousse jamais sur `master` : on y merge via Pull Request. Le hook pre-push local reste une
protection supplémentaire, même lorsque la règle GitHub est active.

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
- Ne jamais merger une PR dont la vérification CI est rouge, même si GitHub propose le bouton de
  merge en l'absence de protection de branche.
- Ouvrir la PR **dès que le travail est prêt à être relu**, pas en fin de chantier (une PR en
  draft est très bien).
- Remplir le template de PR, en particulier la liste des fichiers/zones touchées et les
  migrations.

La CI utilise Node 22 et exécute, dans l'ordre : installation reproductible des dépendances, lint,
vérification TypeScript, tests et build. Pour reproduire ces contrôles localement :

```bash
npm ci
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Le build nécessite les variables publiques listées dans `.env.example`. Des valeurs factices
suffisent pour vérifier le build ; ne jamais utiliser de secret ou de clé de production en CI.

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
