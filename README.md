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
- Chaque carte est tirée indépendamment : C 59 %, R 25 %, SR 10 %, SSR 5 %, LR 1 %.
  Une LR tirée a ensuite 5 % de chances d’être Shiny. Une SSR tirée n’est jamais Shiny.
  Les doublons sont possibles et ont chacun un identifiant et une date d’obtention.
- Choix de démarrage : une réserve pleine de 5 packs à la création du compte, collection vide.
- Un pack de 5 cartes toutes les 15 minutes, stock maximal de 5.
  Le temps écoulé hors ligne est pris en compte. Au plafond, le compteur s’arrête ;
  ouvrir un pack relance un délai complet de 15 minutes.
- La collection et le compteur sont enregistrés dans localStorage sous
  `yokkai-collec-v1`. Les données appartiennent à ce navigateur et cette origine.
- Le tirage entier est sauvegardé avant sa révélation. Quitter ou recharger
  pendant l’animation conserve toutes les cartes dans la collection.
  La progression visuelle de la révélation n’est pas persistée.
- Les cartes se révèlent au clic, dans l’ordre C → R → SR → SSR → LR.
- Trois exemplaires SSR non-Shiny identiques peuvent être consommés depuis la collection
  pour créer une SSR Shiny évoluée du même personnage. C’est la seule façon d’obtenir une SSR Shiny.
- Un Decision Pack est disponible toutes les 24 heures, indépendamment des Regular
  Packs. Il propose cinq cartes (SR 94 %, SSR 5 %, LR 1 %) et une seule est conservée.
  Un choix en attente est sauvegardé côté serveur et ne peut pas être relancé.
- L’écran de reveal permet de défausser immédiatement une carte d’un Regular ou
  Decision Pack. La dernière option d’un Decision Pack ne peut pas être défaussée.
- Chaque profil possède un solde de Karas, initialisé à 0 et affiché dans la
  topbar. Les opérations atomiques de crédit et débit sont réservées au serveur ;
  le marché crédite désormais les vendeurs lors du règlement des enchères.
- Le marché permet de publier une carte pour 15 min, 30 min, 1 h, 4 h, 12 h ou
  24 h, de miser par paliers d’au moins 10 Karas et de suivre une enchère. Une
  carte publiée est gelée jusqu’à la vente ou l’expiration. Les mises sont
  débitées immédiatement, l’ancien meneur est remboursé atomiquement et une
  mise dans les cinq dernières minutes prolonge la vente d’une minute.
- Les vues du marché couvrent les ventes actives, mes enchères, les enchères
  gagnées et les cartes vendues/non vendues, avec filtres de rareté et tris par
  prix ou fin imminente. Le détail affiche l’historique complet des mises.
- Le profil permet de rechercher un joueur par pseudo, d’envoyer une demande
  d’ami et de consulter les demandes reçues, envoyées et acceptées. Une demande
  peut aussi être initiée directement depuis le profil public d’un joueur.
- Les amis peuvent proposer des échanges combinant plusieurs exemplaires et un
  montant optionnel de Karas de chaque côté. Le destinataire peut accepter,
  refuser ou créer une contre-offre. L’acceptation revérifie et transfère toutes
  les possessions dans une transaction unique.
- La collection est paginée par groupes de 20 cartes avec des numéros de page.
  Les exemplaires peuvent être classés dans un dossier personnel optionnel.
- Une LR, obtenue uniquement par tirage direct, porte la mention « Premier propriétaire »
  et sa date d’obtention.
- Un trigger retire automatiquement une carte de la wishlist dès qu’un exemplaire
  rejoint `user_cards`, quelle que soit la source de l’acquisition.
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
