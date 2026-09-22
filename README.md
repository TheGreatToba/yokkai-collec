# Yokkai Collec'

Prototype v0.1 : Next.js (App Router), TypeScript, Tailwind CSS et ESLint.

## Développement

Prérequis : Node.js 22 LTS et npm.

```sh
npm ci
npm run dev
```

Ouvrir http://localhost:3000.

## Vérifications

```sh
npm run lint
npm run build
```

## Périmètre et architecture

- `spec-complete-vision.md` décrit la vision à long terme.
- `v0.1-mvp.md` définit le seul périmètre à implémenter.
- Étape 1 : initialisation et page d’accueil temporaire en français.
- À partir de l’étape 2, tout accès aux données du jeu passera exclusivement
  par `lib/data/cards.ts` : catalogue, collection, boosters et persistance.
- La v0.1 utilisera des données en dur et localStorage, sans base de données.

Les fonctionnalités de jeu seront implémentées aux étapes suivantes.
