# Workflow d'équipe — à lire en premier

Deux devs travaillent en parallèle sur ce repo. Détails complets : [docs/COLLABORATION.md](docs/COLLABORATION.md).

Règles non négociables :
- Toujours lancer `git status` et `git fetch origin` avant de commencer une tâche.
- Ne jamais pousser directement sur `master` : partir d'une branche `<initiales>/<description>` créée depuis `origin/master`.
- Ouvrir une Pull Request pour toute tâche, même petite.
- Indiquer dans la PR les migrations Supabase qu'elle contient et si elles sont déjà appliquées sur le VPS ou non.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## graphify

Graphify is optional: graphify-out/ is a locally generated graph, not shipped with the repository. Install Graphify on PATH and generate a graph to enable its hooks. Without the CLI or graph, use rg/source reads; the hook reports the missing prerequisite and continues.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` when the CLI and local graph are available (AST-only, no API cost).
