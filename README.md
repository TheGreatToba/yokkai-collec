# Yokkai Collec’

Prototype v0.1 : Next.js App Router, TypeScript, Tailwind CSS et ESLint.
Périmètre : `v0.1-mvp.md`. La vision à long terme est dans `spec-complete-vision.md`.

## Démarrage

Node.js 22 et npm :

```sh
npm ci
npm run dev
```

Ouvrir http://localhost:3000 pour les packs, et `/collection` pour la collection.

## Vérifications

```sh
npm run lint
npm test
npm run build
```

Les tests couvrent les seuils de tirage, le tri, les doublons, la sauvegarde,
la régénération (y compris après une absence), le plafond et une sauvegarde corrompue.
Ils vérifient aussi la restauration après rechargement, le maintien de l’échéance
après ouverture, un échec d’écriture et les accès concurrents entre deux onglets simulés.

## Données et règles

- Tout accès aux données passe par les fonctions asynchrones de `lib/data/cards.ts`.
  Le catalogue contient 30 cartes et des images SVG placeholder autonomes,
  réparties entre Anime/Manga, Sport et Cinéma.
- Un utilisateur local unique ; aucune authentification ni base de données.
- Chaque carte est tirée indépendamment : C 60 %, R 25 %, SR 10 %, SSR 5 %.
  Les doublons sont possibles et ont chacun un identifiant et une date d’obtention.
- Choix de démarrage : un pack offert à la première visite, collection vide.
- Un pack de 10 cartes toutes les 30 minutes, stock maximal de 3.
  Le temps écoulé hors ligne est pris en compte. Au plafond, le compteur s’arrête ;
  ouvrir un pack relance un délai complet de 30 minutes.
- La collection et le compteur sont enregistrés dans localStorage sous
  `yokkai-collec-v1`. Les données appartiennent à ce navigateur et cette origine.
- Le tirage entier est sauvegardé avant sa révélation. Quitter ou recharger
  pendant l’animation conserve toutes les cartes dans la collection.
  La progression visuelle de la révélation n’est pas persistée.
- Les cartes se révèlent au clic, dans l’ordre C → R → SR → SSR.
- La collection affiche les plus rares en premier, propose deux filtres et
  une modale de détail (fermeture par bouton, Échap ou clic sur le fond).
- Les sauvegardes invalides sont conservées et signalées, jamais écrasées automatiquement.
- Lorsque Web Locks est disponible, toutes les opérations sur l’état du joueur
  partagent un verrou entre onglets, y compris les lectures qui régénèrent les packs.
  Sans cette API, utiliser un seul onglet pour éviter les écritures concurrentes.

Les fonctions publiques sont asynchrones pour permettre de remplacer leur
implémentation par un accès à une DB sans changer leurs appels dans les composants.
Les données locales et l’horloge du navigateur ne constituent pas une protection
contre la modification manuelle ; ce prototype reste un jeu local.
