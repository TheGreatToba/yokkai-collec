# Prompt à coller dans Codex

> Place d'abord le dossier `design_handoff_yokkai_collec/` à la racine du repo, puis colle le texte ci-dessous.

---

Tu travailles sur mon projet Next.js + Tailwind "Yokkai Collec'" (jeu de cartes gacha). La logique métier (boosters, collection, enchères, échanges, wishlist, notifications, karas) est déjà codée. Ta mission : **appliquer le nouveau design UI** décrit dans `design_handoff_yokkai_collec/` **sans casser ni réécrire la logique existante**.

## Sources de vérité
1. `design_handoff_yokkai_collec/README.md` — spec complète (tokens, composants, écrans, états, animations). Lis-le en entier avant de coder.
2. `design_handoff_yokkai_collec/tokens/tailwind.preset.js` — tokens Tailwind.
3. `design_handoff_yokkai_collec/design/*.dc.html` — maquettes HTML de référence (styles inline = valeurs exactes à reprendre). Ce ne sont PAS des fichiers à importer : lis-les pour extraire les valeurs.
4. `design_handoff_yokkai_collec/public/assets/` — `booster-pack.png`, `card-back.png` à copier dans `/public/assets/`.

## Règles
- Commence par **explorer le repo** : structure `app/` ou `pages/`, composants existants, hooks/API, gestion d'état, config Tailwind. Fais-moi un court plan de correspondance *écran de la maquette → fichier/route existant* avant de modifier quoi que ce soit.
- **Ne modifie pas** les appels API, les server actions, les types métier, les règles (prix, durées, barème de destruction, anti-snipe, limite 5 enchères, etc.). Tu ne touches qu'à la couche présentation. Si un écran du design a besoin d'une donnée qui n'existe pas, signale-le au lieu de l'inventer.
- Ajoute le preset Tailwind (`presets: [require('./design_handoff_yokkai_collec/tokens/tailwind.preset.js')]`, ou copie son contenu dans `tailwind.config`) et charge les polices Cinzel, Sora, Noto Serif JP via `next/font/google`.
- Utilise les tokens (`bg-surface`, `border-veil`, `text-ink-2`, `rounded-card`, `shadow-modal`, `bg-karas`…) plutôt que des hex en dur.
- Respecte `prefers-reduced-motion` (désactive rotations, pulses, étincelles, déchirure).

## Ordre de travail (un commit par étape)
1. **Fondations** : preset Tailwind, polices, fond global, composants UI de base réutilisables : `Button` (primary/secondary/danger/disabled), `Chip` (actif/inactif), `StatusPill`, `Karas` (losange + montant formaté fr-FR), `Avatar`, `Modal` (overlay void/86 + blur), `Toast`.
2. **`<YokaiCard rarity shiny name image category number animated />`** : reproduire exactement `design/YokaiCard.dc.html` — ratio 5:7, container queries (`@container` + unités `cqw`), cadres par rareté, surcouche Shiny (SSR/LR seulement), animations. Prévoir une prop `image` pour l'illustration réelle (les initiales de la maquette sont un placeholder). + `<CardBack />` avec `card-back.png`.
3. **Topbar** globale : onglets, recherche, cloche + panneau de notifications, pilule karas toujours visible, avatar.
4. **Boosters** : sélection des packs → déchirure → paquet empilé + rangée de 10 emplacements → reveals SR/SSR/LR/Shiny → récap. **Decision Pack** : phase de choix d'une seule carte + modale de confirmation + état « PERDUE ». Brancher sur la logique d'ouverture existante (l'ordre de rareté croissante vient déjà du back).
5. **Collection** : filtres, grille triée, dates, état gelé, sélection multiple + barre de destruction groupée, modale détail (valeur de marché, mise aux enchères, destruction rapide, fusion SSR→LR si applicable).
6. **Profil** (moi + vue d'un autre joueur sans actions d'édition), **Marché** (liste + 4 vues), **page Enchère**, **Échanges**, **Recherche**, **Wishlist**.
7. **Sons** : hook `useSfx()` avec des fichiers audio (placeholder si absents) déclenchés aux mêmes moments que la maquette (tear, flip, slide, ssr, lr, shiny).

## Vérification
Après chaque étape : `npm run build` et lint sans erreur ; compare visuellement avec la maquette ouverte via `npx serve design_handoff_yokkai_collec/design` (fichier `Yokkai Collec v3.dc.html`) ; vérifie à 1440px et ~900px de large. À la fin, liste ce qui diffère encore de la maquette et les données manquantes côté API.
