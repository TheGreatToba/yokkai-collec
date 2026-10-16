# Validation de la nouvelle phase 1

## Contrôles ciblés passés

`python docs/art-direction-enchantment/check-study.py`

| Direction       | Minimum des paires de texte vérifiées |
| --------------- | ------------------------------------- |
| Obsidian Ritual | 4,80:1                                |
| Scarlet Court   | 8,08:1                                |
| Astral Vault    | 9,13:1                                |

Paires vérifiées : texte principal, secondaire, accent et Karas sur fond et surface ; texte d’action sur les deux extrémités de son dégradé ; couleurs des raretés, noms et métadonnées sur cartouche opaque ; texte sombre sur badge Shiny clair. Les matières décoratives et halos ne sont pas assimilés à des fonds de lecture certifiés. Une revue des contrastes de chaque état du produit restera nécessaire en phase 2.

Le contrôle confirme également : documents anglais, un h1 par page, huit cartes par direction (sept cadres + vitrine), images nommées et dimensionnées, liens et assets locaux existants, aucun script, chaque illustration WebP sous 200 Ko, présence du focus visible et de la règle de mouvement réduit.

## Navigateur réel

Inspection visuelle des trois propositions et captures conservées :

- Desktop 1440 × 1000 : `assets/obsidian-desktop.png`, `assets/scarlet-desktop.png`, `assets/astral-desktop.png`.
- Mobile 390 × 844 : `assets/obsidian-mobile.png`, `assets/scarlet-mobile.png`, `assets/astral-mobile.png`.
- Inspection complémentaire de la grille mobile pour vérifier le mélange photo/dessin et les indices de rareté.
- Navigation clavier : passage du lien d’évitement au lien de comparaison, focus `solid 3px` observé.

Les trois pages ont été mesurées à 320, 768, 1024 et 1440 px : aucun débordement horizontal de document. Les grilles passent de deux à quatre puis sept colonnes. Mesures brutes : `layout-audit.json`. Le scrollbar desktop occupe 15 px dans cet environnement ; les largeurs de contenu de 305/753/1009/1425 px sont donc attendues.

Une correction a été apportée à Astral Vault pendant la revue : les traverses optiques restent sur le périmètre et ne passent plus sur les noms ni sur les portraits. La capture desktop finale reflète cette correction.

## Limites explicites

- Ce sont des propositions statiques de charte, pas des pages fonctionnelles du jeu : pas de filtre, de session, d’achat, d’enchère, de tirage ou de modification Supabase.
- Les ancres `Market`, `Friends`, `Wishlist`, `Newest first` renvoient à des zones d’étude ; elles ne prétendent pas fournir ces fonctions.
- Les polices et les deux photographies demandent Internet. Les illustrations WebP et les cadres sont locaux.
- Le respect de mouvement réduit est vérifié dans le CSS ; aucune émulation de préférence système ni audit de lecteur d’écran complet n’est annoncé.
- La reconnaissance en une seconde et l’attrait ressenti doivent être évalués par Walid et des joueurs. Les mesures techniques ne valident pas une préférence artistique.
- Aucun code de production ou test existant changé ; aucune migration Supabase ; aucune CI complète locale. Le statut GitHub de la nouvelle PR fait foi pour la CI distante.
