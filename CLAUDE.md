# Workflow d'équipe — à lire en premier

Deux devs travaillent en parallèle sur ce repo. Détails complets : [docs/COLLABORATION.md](docs/COLLABORATION.md).

Règles non négociables :

- Aucune PR mergée sans CI GitHub Actions verte sur la branche à jour avec origin/master.

- Lancer npm run format avant tout commit ; ne jamais utiliser --no-verify.

- Ne jamais affaiblir un test existant (assertion supprimée ou assouplie, seuil abaissé, test ignoré) dans la même PR que le code qu'il vérifie. Si un test protège une décision produit (qualité des images, droits SQL, taux de drop…), toute modification doit être signalée explicitement dans la description de la PR et validée par Walid.

- Toujours lancer `git status` et `git fetch origin` avant de commencer une tâche.
- Ne jamais pousser directement sur `master` : partir d'une branche `<initiales>/<description>` créée depuis `origin/master`.
- Ouvrir une Pull Request pour toute tâche, même petite.
- Indiquer dans la PR les migrations Supabase qu'elle contient et si elles sont déjà appliquées sur le VPS ou non.

## CI — GitHub Actions uniquement

- La CI complète est exécutée par GitHub Actions. Les agents ne lancent jamais `npm run verify`, `npm run ci` ni `npm run ci:db` en local, y compris dans les plans des PR de traduction.
- En local : lancer `npm run format` avant chaque commit et laisser le hook pre-push existant (`verify:quick`) s'exécuter. Ne jamais contourner les hooks.
- Les triggers `push` et `pull_request` vers `master` de `.github/workflows/ci.yml` restent actifs. Ne jamais les désactiver sans accord explicite de Walid.
- Après le push, ouvrir la PR puis surveiller `gh pr checks`. Lire les logs seulement en cas d'échec (`gh run view <id> --log-failed`, fin utile uniquement), corriger puis repousser. Une PR est prête à merger quand la CI GitHub est verte sur la branche à jour avec `origin/master`.
- Dans la partie validation de la PR, indiquer seulement les checks passés ou la cause de l'échec ; ne jamais coller de sortie de vérification locale.
- Regrouper les commits et éviter les push à répétition.

## English first

Attendre la confirmation de Walid que les PR #235, #226 et la correction du `<h1>` du marché sont mergées avant de rebaser et de commencer `wz/en-shell`. Cette règle CI s'applique aussi aux plans des PR de traduction.

@AGENTS.md

## graphify

Graphify is optional: graphify-out/ is a locally generated graph, not shipped with the repository. Install Graphify on PATH and generate a graph to enable its hooks. Without the CLI or graph, use rg/source reads; the hook reports the missing prerequisite and continues.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` when the CLI and local graph are available (AST-only, no API cost).

## Langue du produit : English first

- Yokkai Collec' est un produit en anglais d'abord, pour un public mondial.
- Tout texte visible par les joueurs est en anglais : interface, boutons, erreurs et succès, états vides, notifications, aria-label et alt, métadonnées, emails Auth, noms et descriptions des succès, pages légales et d'aide.
- Toute nouvelle route est en anglais, minuscules, avec des tirets.
- Noms de tables/colonnes et valeurs techniques en anglais ; textes affichés aux joueurs enregistrés en base en anglais.
- Les nouvelles fonctions SQL renvoient des codes d'erreur stables ; le texte anglais est affiché côté interface.
- Formats (dates, nombres, pluriels) en-US ; noms propres de cartes/personnages/franchises inchangés.
- PR, commits et docs internes peuvent rester en français ; seul ce que voient les joueurs doit être en anglais.
- Avant chaque PR : grep des textes visibles ajoutés, aucun mot de français dans l'interface.
