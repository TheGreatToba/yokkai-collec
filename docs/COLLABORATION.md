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

## CI — GitHub Actions uniquement

- La CI complète est exécutée par GitHub Actions. Les agents ne lancent jamais `npm run verify`, `npm run ci` ni `npm run ci:db` en local, y compris dans les plans des PR de traduction.
- En local : lancer `npm run format` avant chaque commit et laisser le hook pre-push existant (`verify:quick`) s'exécuter. Ne jamais contourner les hooks.
- Les triggers `push` et `pull_request` vers `master` de `.github/workflows/ci.yml` restent actifs. Ne jamais les désactiver sans accord explicite de Walid.
- Après le push, ouvrir la PR puis surveiller `gh pr checks`. Lire les logs seulement en cas d'échec (`gh run view <id> --log-failed`, fin utile uniquement), corriger puis repousser. Une PR est prête à merger quand la CI GitHub est verte sur la branche à jour avec `origin/master`.
- Dans la partie validation de la PR, indiquer seulement les checks passés ou la cause de l'échec ; ne jamais coller de sortie de vérification locale.
- Regrouper les commits et éviter les push à répétition.

## English first

Attendre la confirmation de Walid que les PR #235, #226 et la correction du `<h1>` du marché sont mergées avant de rebaser et de commencer `wz/en-shell`. Cette règle CI s'applique aussi aux plans des PR de traduction.

## 5. Pousser souvent

Ne pas laisser une branche locale avec beaucoup de commits non poussés. Pousser régulièrement
(`git push -u origin <branche>`) et ouvrir la PR tôt pour limiter la fenêtre de collision.

## 6. Migrations Supabase

- **Une seule personne à la fois** applique des migrations sur le VPS de production (`62.83.37.242`).
  Prévenir sur Discord **avant** de le faire.
- Le manifeste de reprise opérationnel est `/opt/yokkai-ops/runtime/compose-production.json`.
  Vérifier sa concordance avec les conteneurs actuels avant toute utilisation ciblée.
  Les fichiers du dossier historique `yokkai-migration-20261023` restent des archives et ne doivent pas servir à redéployer.
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

## Langue du produit : English first

- Yokkai Collec' est un produit en anglais d'abord, pour un public mondial.
- Tout texte visible par les joueurs est en anglais : interface, boutons, erreurs et succès, états vides, notifications, aria-label et alt, métadonnées, emails Auth, noms et descriptions des succès, pages légales et d'aide.
- Toute nouvelle route est en anglais, minuscules, avec des tirets.
- Noms de tables/colonnes et valeurs techniques en anglais ; textes affichés aux joueurs enregistrés en base en anglais.
- Les nouvelles fonctions SQL renvoient des codes d'erreur stables ; le texte anglais est affiché côté interface.
- Formats (dates, nombres, pluriels) en-US ; noms propres de cartes/personnages/franchises inchangés.
- PR, commits et docs internes peuvent rester en français ; seul ce que voient les joueurs doit être en anglais.
- Avant chaque PR : grep des textes visibles ajoutés, aucun mot de français dans l'interface.
- Toute nouvelle fonctionnalité ou modification doit écrire directement en anglais ses textes destinés aux joueurs, y compris les états d’erreur et les textes accessibles, sans attendre une PR de traduction.

## Responsive obligatoire pour les interfaces web

- Toute création ou modification de site, page ou composant doit fonctionner sur mobile, tablette et ordinateur dès son ajout. Le responsive fait partie des critères de réalisation, même sans demande explicite.
- Concevoir pour les petits écrans en premier (mobile-first), dès 320 px, puis adapter la mise en page au contenu avec les conventions et points de rupture du projet. Préférer les dimensions fluides, Flexbox/Grid et les images adaptatives aux largeurs fixes.
- Éviter tout débordement horizontal de la page, texte tronqué, chevauchement ou contenu inaccessible. Pour les tableaux ou contenus qui nécessitent un défilement horizontal, le limiter à leur conteneur sans masquer les informations utiles.
- Adapter navigation, menus, fenêtres modales, formulaires, images et grilles ; conserver des textes lisibles, des commandes accessibles au clavier et des zones tactiles suffisantes. Aucune interaction essentielle ne doit dépendre uniquement du survol.
- Vérifier les zones modifiées dans un navigateur à 320, 375, 768, 1024 et 1440 px, ainsi que les tailles intermédiaires pertinentes ; vérifier aussi le zoom à 200 %. Corriger les régressions avant de déclarer la tâche terminée. Si une vérification est impossible, indiquer explicitement ce qui reste non vérifié.
