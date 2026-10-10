# Workflow d'équipe — à lire en premier

Deux devs travaillent en parallèle sur ce repo. Détails complets : [docs/COLLABORATION.md](docs/COLLABORATION.md).

Règles non négociables :
- Toujours lancer `git status` et `git fetch origin` avant de commencer une tâche.
- Ne jamais pousser directement sur `master` : partir d'une branche `<initiales>/<description>` créée depuis `origin/master`.
- Ouvrir une Pull Request pour toute tâche, même petite.
- Indiquer dans la PR les migrations Supabase qu'elle contient et si elles sont déjà appliquées sur le VPS ou non.

@AGENTS.md

## graphify

Graphify is optional: graphify-out/ is a locally generated graph, not shipped with the repository. Install Graphify on PATH and generate a graph to enable its hooks. Without the CLI or graph, use rg/source reads; the hook reports the missing prerequisite and continues.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` when the CLI and local graph are available (AST-only, no API cost).
