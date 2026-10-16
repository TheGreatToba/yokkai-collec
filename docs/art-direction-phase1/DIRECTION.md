# Yokkai Collec’ — Direction artistique / Phase 1

16 octobre 2026 · Proposition soumise au choix de Walid · Aucun code de production.

## Le parti pris

Collectionner la culture, sans imposer un univers fictionnel à toutes les cartes. Une photo de chanteuse, un personnage dessiné et un joueur de basket doivent sembler appartenir au même objet de collection, sans transformer leurs images en illustrations uniformes.

L’interface organise le rituel quotidien ; les cartes portent l’intensité. Les trois propositions utilisent exactement le même contenu, les cinq raretés et les deux Shiny pour permettre une comparaison honnête. [Ouvrir le comparateur](index.html), puis chaque page à pleine largeur pour voir la composition desktop. Les cadres intégrés du comparateur montrent les compositions étroites.

## 01 — Folio Club · Recommandée

**Concept.** Un club de collection contemporain dont chaque carte est une pièce soigneusement archivée. Une identité éditoriale, tactile et accueillante réunit toutes les cultures sans privilégier anime, sport ou photographie.

**Mood.** Catalogues d’exposition, chemises d’archives, pochettes de disques indépendants, impressions sur papier teinté. Grille rigoureuse, asymétrie mesurée, filets et numérotation ; aucune citation de jeu de cartes.

| Rôle           | Hex       | Usage                                |
| -------------- | --------- | ------------------------------------ |
| Fond           | `#121716` | Toile presque noire, nuance végétale |
| Surface        | `#1C2421` | Panneaux et menus                    |
| Carte          | `#18201D` | Cartouche opaque                     |
| Image          | `#303E37` | Passe-partout neutre                 |
| Texte          | `#F4F1E8` | Blanc papier                         |
| Secondaire     | `#B7C1B8` | Aide, métadonnées                    |
| Accent / focus | `#D9EDAA` | Action principale et repère actif    |
| Ligne          | `#435148` | Séparation, jamais texte courant     |

**Typographie.** Space Grotesk 500/700 pour titres et noms ; Manrope 400/600/700 pour lecture et contrôles. Google Fonts, SIL OFL 1.1 ; versions finales auto-hébergées, deux familles limitées aux graisses utiles. Pas de sérif pseudo-fantasy sur les noms pop culture.

**Logo.** Mot-symbole bas de casse, ouvert et compact ; `COLLEC’` devient une signature secondaire. Le signe proposé est une construction originale de deux feuillets emboîtés avec une traverse décentrée, dessinée en SVG ; il évoque ranger et découvrir, sans boule, créature, blason ou étoile empruntée. Pas de mascotte à cette étape : la diversité des personnages est déjà le centre de gravité.

**Carte.** Rectangles à coins presque droits, image exposée dans un passe-partout sombre, légende alignée à gauche. Une tranche graduée occupe le haut : cinq barres maximum, lettre de rareté permanente. SR ajoute un filet ; SSR deux traverses ; LR une double enceinte métallique. Shiny introduit un bord spectral clair et un second contour externe : il reste identifiable sans mouvement et en niveaux de gris.

**Booster.** Sachet vert papier à grands feuillets superposés pour Regular ; pochette grisée à cinq bandes, une pleine, pour Decision. Crans de soudure et nom explicite : leur différence ne dépend pas de la teinte. Le motif devient au verso une composition de feuillets décentrés, pas une rosace.

**Mouvement.** Déchirure horizontale nette, sortie de cinq pièces en éventail court, pose sur le plan. C/R : 140–180 ms ; SR : reflet unique de 240 ms ; SSR : double liseré en 420 ms ; LR : assemblage du double cadre en 650 ms ; Shiny : traversée spectrale unique de 900 ms. Pas de pulsation permanente en collection. Alternative statique : cartes déjà posées, cadre final et texte de révélation identiques.

**Atout / compromis.** Meilleure neutralité entre photo et dessin et meilleure endurance quotidienne ; le spectacle doit être particulièrement soigné sur LR et Shiny pour conserver le désir de collection.

[Maquette Folio Club](folio.html)

## 02 — Light Matter

**Concept.** Chaque découverte devient un fragment de lumière conservé dans une capsule optique. L’interface évoque un instrument calme tandis que les cartes rares concentrent réfraction, profondeur et éclat.

**Mood.** Optique de laboratoire, verre dichroïque, installations lumineuses, photographie de matières translucides. Des formes arrondies et une composition centrée donnent un sentiment de découverte personnelle, sans décor spatial littéral.

| Rôle           | Hex       | Usage               |
| -------------- | --------- | ------------------- |
| Fond           | `#10151F` | Bleu charbon        |
| Surface        | `#1B2431` | Panneaux            |
| Carte          | `#17202C` | Cartouches          |
| Image          | `#2D3D52` | Passe-partout       |
| Texte          | `#F0F5FF` | Blanc froid         |
| Secondaire     | `#B9C6DB` | Aide et métadonnées |
| Accent / focus | `#A9EAFF` | Actions et lumière  |
| Ligne          | `#43536B` | Séparation          |

**Typographie.** Syne 600/700/800 pour titres et signature ; IBM Plex Sans 400/500/600 pour interface. Google Fonts, SIL OFL 1.1. Syne reste réservé à des lignes courtes ; Plex porte les noms longs et les nombres.

**Logo.** Trois ouvertures carrées réunies par leur espace négatif, deux en haut et une en bas ; un signe de rencontre et non un symbole cosmique. Mot-symbole large avec `o` ouvert sur une diagonale à finaliser après sélection. La maquette expose le signe SVG original et une étude typographique, pas un logo déjà livré.

**Carte.** Image dans une fenêtre arrondie et cartouche d’identification opaque. Les mêmes barres graduées garantissent la lecture en vignette ; la matière progresse du verre dépoli au contour optique double. LR possède une arche supérieure plus marquée. Shiny : contour blanc dédoublé, facette diagonale permanente et sceau `S`, plutôt qu’un arc-en-ciel qui modifierait toute la photo.

**Booster.** Capsule souple à sommet arrondi ; Regular porte une ouverture unique, Decision cinq lamelles verticales dont une pleine. Les dégradés sont réservés à l’objet, avec texte sur zone sombre stable. Dos envisagé : trois fenêtres ouvertes sur un aplat de nuit.

**Mouvement.** Ouverture par séparation de deux feuilles, sortie en profondeur avec déplacement limité à 16 px, un reflet réfracté par révélation. 180 ms C/R, 300 ms SR, 500 ms SSR, 750 ms LR, 1 000 ms Shiny maximum. Aucun flou animé, aucun canvas ni particule permanente. En mouvement réduit : révélation instantanée et facettes fixes.

**Atout / compromis.** Le plus spectaculaire pour les révélations ; demande davantage de discipline pour que le chrome et les effets froids ne rivalisent pas avec les images chaudes ou modestes.

[Maquette Light Matter](lumen.html)

## 03 — Culture Press

**Concept.** Une collection vivante comme un magazine pop que chacun compose avec ses icônes. La marque assume l’énergie de l’affiche, du collage et de l’édition indépendante, tout en conservant un fond sombre calme.

**Mood.** Sérigraphie, fanzines musicaux, billets de concerts, composition typographique grand format. Couleurs franches sur objets, filets perforés et décalages contrôlés ; pas de stickers qui couvrent les visages.

| Rôle           | Hex       | Usage            |
| -------------- | --------- | ---------------- |
| Fond           | `#1C1622` | Prune charbon    |
| Surface        | `#2C2233` | Panneaux         |
| Carte          | `#271D2E` | Cartouches       |
| Image          | `#44324D` | Passe-partout    |
| Texte          | `#FFF2E9` | Papier chaud     |
| Secondaire     | `#D3BACF` | Aide et légendes |
| Accent / focus | `#FFB891` | Abricot imprimé  |
| Ligne          | `#6A506C` | Séparation       |

**Typographie.** Bricolage Grotesque 600/700/800 pour titres, signature et noms courts ; DM Sans 400/500/700 pour l’interface. Google Fonts, SIL OFL 1.1. Titres expressifs, petits textes sans compression ni inclinaison.

**Logo.** `yokkai` dense avec ponctuation détachée ; symbole original composé de trois bandes en escalier qui s’assemblent en Y. Apostrophe traitée comme une encoche de papier. Le système reste reconnaissable en une seule encre et sans mascotte.

**Carte.** Bord gauche de tranche épaisse, rang de rareté façon index imprimé, séparation perforée au-dessus de l’image. Progression de filets simples vers doubles et surimpressions métalliques ; Shiny ajoute une seconde découpe externe discontinue et une tranche spectrale. Ni statistiques de combat, ni médaillon central, ni grand bandeau de franchise.

**Booster.** Regular abricot avec grande signature diagonale ; Decision lavande à cinq bandes et sélection pleine. Coins droits, soudures franches, impression en deux tons. Dos proposé : trame diagonale à grandes bandes et signature coupée, sans imitation de dos existant.

**Mouvement.** Déchirure de ticket, arrivée franche et arrêt immédiat ; pas de secousse de l’écran. 140 ms C/R, 220 ms SR, 400 ms SSR, 600 ms LR, 850 ms Shiny avec une seule surimpression. Alternative statique : tampon final déjà imprimé et texte de rareté conservé.

**Atout / compromis.** La personnalité la plus immédiate et la plus sociale ; plus polarisante et plus difficile à maintenir discrète dans les écrans d’enchères denses.

[Maquette Culture Press](press.html)

## Le contrat image : préserver plutôt qu’uniformiser

Le ratio extérieur reste **5:7**, déjà présent dans le projet. L’intérieur est composé de trois zones indépendantes : rail de rareté opaque, fenêtre d’image normalisée, légende opaque. Aucune information essentielle ne dépend du contraste d’une illustration.

1. Fenêtre commune à tous les styles, sans détourage obligatoire. `object-fit: contain` par défaut : une image carrée garde ses bords, une photo portrait garde le visage. Les bandes restantes sont un passe-partout uni lié à la direction, jamais une image floutée agrandie en temps réel.
2. Recadrage `cover` autorisé seulement après validation éditoriale d’un point focal par carte, sans supprimer de texte ou de visage. Ce n’est pas une condition préalable à la refonte et aucun champ de base de données n’est supposé acquis.
3. Aucun masque ne mange le sujet. En grand format seulement, un filet intérieur atténue une rupture claire/sombre ; les coins découpent la fenêtre, pas le visage. Ni filtre coloré universel ni dégradé noir imposé sur les yeux.
4. Nom et franchise hors image, sur fond opaque. En vignette : deux lignes maximales, puis troncature ; nom complet accessible dans la vue détail et son nom accessible. En détail/zoom : retour à la ligne libre. Un éventuel état sur image possède sa propre capsule opaque.
5. Holo limité au cadre et à une facette translucide de faible couverture. Le portrait conserve ses couleurs. La version OG utilise exactement le même contrat de zones, avec effets statiques et sans dépendance aux polices système.
6. Image pauvre : ne pas inventer du détail par agrandissement. Conserver la résolution disponible, réserver l’espace avec dimensions explicites et proposer le zoom uniquement si utile. Image manquante : silhouette abstraite originale + nom + rareté ; aucun pack utilisé comme faux portrait.

Les maquettes confrontent dessin portrait clair, dessin carré sombre et photographie portrait. Les dessins SVG sont originaux ; les photos sont des études de portrait chargées depuis Unsplash, pas des cartes de célébrités attribuées. Les noms sont fictifs. Aucun de ces portraits ne doit être importé automatiquement dans le jeu. Les images et Google Fonts demandent une connexion ; les fonds, cadres et contenus restent disponibles hors ligne avec polices de repli.

## Rareté : une seconde, même sans couleur

| Niveau            | Code non chromatique permanent                                       | Matière / accent proposé               |
| ----------------- | -------------------------------------------------------------------- | -------------------------------------- |
| C                 | `C`, une barre, enceinte simple                                      | Mat · `#B7BEC8`                        |
| R                 | `R`, deux barres                                                     | Métal froid · `#9BD9EC`                |
| SR                | `SR`, trois barres + traverse supérieure                             | Satin · `#C6B7FF`                      |
| SSR               | `SSR`, quatre barres + deux traverses                                | Cuivre clair · `#FFB8A1`               |
| LR                | `LR`, cinq barres + enceinte double, contour plus épais              | Champagne · `#F3D58F`                  |
| LR Shiny          | `LR / S`, cinq barres, contour clair dédoublé, `SHINY · Direct pull` | Spectre fixe + reflet ponctuel         |
| SSR Shiny évoluée | `SSR / S`, quatre barres, contour clair dédoublé, `SHINY · Evolved`  | Même prestige Shiny, origine distincte |

La variante n’est pas une sixième rareté. Aucun tirage direct SSR Shiny n’est suggéré ; LR Shiny est le seul Shiny de tirage, de l’ordre d’une carte sur un million, et cette fréquence n’est pas une promesse par pack. Les sept spécimens sont un catalogue de comparaison, pas un résultat de pack représentatif.

À 320 px : deux colonnes, marges 16 px, gouttière 14 px, carte d’environ 137 px. Badge de 13 px, barres de 10–22 px et contours visibles en niveaux de gris. La reconnaissance en moins d’une seconde reste **à tester auprès de joueurs**, pas acquise par une inspection technique : montrer une grille 1 s, masquer, demander les LR/Shiny, répéter sans couleur. Objectif proposé : ≥ 90 % de bonnes identifications, sans mouvement.

## Accessibilité et performance

Les valeurs des textes, accents et fonds sont vérifiées par le calcul WCAG sRGB dans `check-proposals.py` (sans dépendance). Il vérifie aussi toutes les couleurs de rareté sur les cartouches des trois directions, les liens entre fichiers et l’absence de scripts. Les rapports mesurés se trouvent dans `VALIDATION.md`. Les traits décoratifs et dégradés ne servent jamais de surface à du texte indispensable.

Focus visible 3 px avec décalage, cibles principales ≥ 44 px, liens et disclosure natifs, navigation sémantique et lien d’évitement. Les prototypes sont statiques ; leur seule transition, le défilement doux, devient instantanée sous `prefers-reduced-motion`. La phase 2 devra aussi vérifier clavier, annonces de révélation et contraste des états hover/disabled/toasts sur le produit réel. Les signes de statut sont accompagnés de texte anglais.

Pas de bibliothèque d’animation ajoutée. Cadres CSS, signes SVG, transform/opacity pour les séquences futures ; aucune vidéo, aucun blur animé, aucune particule JavaScript. Holo inactif hors écran, un seul effet à la fois pendant une révélation, `Skip animation` disponible dès le début. Les grilles restent statiques ; un smartphone ne doit pas recalculer une scène de foil sur chaque carte.

## Recommandation

**Choisir Folio Club.** C’est la direction qui résout le mieux le vrai problème : rendre désirables des images hétérogènes, sans les faire passer pour des illustrations d’un même univers. Le vert papier et les formes éditoriales donnent une identité distincte ; le rail de rareté demeure stable dans une collection dense et le contraste entre surface mate et Shiny devient un événement.

Light Matter est le choix pertinent si la sensation d’ouverture prime sur le quotidien. Culture Press est le choix pertinent si l’on veut une marque plus expressive et orientée partage. Je déconseille un mélange des trois : conserver un système de cadre et une signature, puis investir le contraste d’intensité dans les objets rares.

## Phase 2 proposée — uniquement après choix

Chaque PR contient sa mise à jour ciblée de `/design-system` et de `docs/BRAND.md`, des captures avant/après **390 px et 1440 px**, l’état des migrations Supabase, et attend une CI GitHub verte sur la branche à jour d’`origin/master`. Aucun test existant affaibli ; format avant chaque commit, hooks conservés. Aucune CI complète locale. Ce découpage ne lance pas `wz/en-shell` et n’anticipe pas la confirmation requise pour #235, #226 et le h1 du marché.

| PR  | Périmètre limité                                                                          | Compatibilité / preuve                                                                                                          |
| --- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tokens sémantiques, contrastes, polices, mouvement, rayons, élévations                    | Remapper les alias Tailwind/CSS actuels sans supprimer les noms encore consommés ; capture des surfaces existantes              |
| 2   | Identité SVG horizontale/icône/mono, favicon, app icon, OG par défaut, Karas              | Remplacement des assets à dimensions stables ; contrôles à 16/32 px et en monochrome                                            |
| 3   | Boutons, inputs, tabs, badges, focus                                                      | API de `components/ui` conservée ; états clavier/erreur/chargement documentés                                                   |
| 4   | Modales, toasts, navigation, vides, erreurs, squelettes                                   | Focus, retour au déclencheur et annonces testés ; aucun changement métier                                                       |
| 5   | Cadre C/R/SR/SSR/LR et Shiny, dos, tailles et états verrouillée/enchère/wishlist/nouvelle | Contrat des données actuel conservé ; matrice photo/dessin, carré/portrait, clair/sombre ; OG carte avec le même rendu statique |
| 6   | Regular/Decision, disponible/recharge/vide                                                | Visuels distincts sans modifier stock, recharge, quota ni économie                                                              |
| 7   | Séquence d’ouverture et intensité par rareté                                              | Réemploi de la séquence métier actuelle ; skip et mouvement réduit, choix Decision et retour de Karas préservés                 |
| 8   | Collection, catalogue, détails et wishlist                                                | Petites sous-PR si nécessaire ; tri/filtres et états indépendants inchangés                                                     |
| 9   | Marché, enchères, échanges                                                                | Séparer marché et échanges si le diff grandit ; droits et confirmations existants préservés                                     |
| 10  | Profils/vitrines, amis, succès, notifications                                             | Sous-PR par groupe cohérent ; noms propres et franchises inchangés                                                              |
| 11  | Landing, auth, paramètres, pages publiques et erreurs restantes                           | Inventaire final de routes et textes anglais, accessibilité complète et documentation consolidée                                |

Les alias temporaires disparaissent uniquement lorsque leurs derniers consommateurs ont migré. Les PR de pages s’appuient sur les composants déjà mergés et restent utilisables entre deux étapes. Pas de migration Supabase prévue pour la DA seule ; toute nécessité nouvelle doit être décrite avant implémentation.

## État de préparation et limites

AGENTS.md, CLAUDE.md, docs/COLLABORATION.md, tailwind.config.ts, les feuilles de styles et `components/ui/index.tsx` ont été examinés ; Graphify a orienté la lecture vers CardShell, YokaiCard, Boosters et la galerie. Les sources de `/design-system`, `boosters-preview` et `collection-preview` ont été parcourues. Les dépendances Next.js 16.3.8 d’un worktree existant ont ensuite été réutilisées et le guide local d’installation a été lu. Le serveur a démarré avec webpack, mais le proxy bloque `/design-system` faute de configuration Supabase dans le worktree isolé : inspection visuelle de l’existant non réalisée. Aucune modification Next n’est livrée.

Le checkout utilisateur contient des changements métier et de tests préexistants ; ils ne font pas partie de la proposition. Une branche dédiée `wz/art-direction-phase1` a été créée dans un worktree depuis la référence locale `origin/master`. Après une première tentative réseau infructueuse, le fetch a réussi et la branche a été rebasée sur `origin/master` (`1af86031` au moment du contrôle). Les PR ouvertes ont été consultées : cette proposition ne touche pas les zones de code des travaux en cours. Le statut exact de commit/PR est consigné dans la livraison, sans prétendre à une CI verte avant son résultat.

## Sources typographiques

- [Space Grotesk — auteur et licence](https://floriankarsten.github.io/space-grotesk/), [Manrope — OFL Google Fonts](https://github.com/google/fonts/blob/main/ofl/manrope/OFL.txt).
- [Syne — OFL Google Fonts](https://github.com/google/fonts/blob/main/ofl/syne/OFL.txt), [IBM Plex — IBM Design Language](https://www.ibm.com/design/language/typography/typeface/).
- [Bricolage Grotesque — OFL Google Fonts](https://github.com/google/fonts/blob/main/ofl/bricolagegrotesque/OFL.txt), [DM Sans — OFL Google Fonts](https://github.com/google/fonts/blob/main/ofl/dmsans/OFL.txt).

Les signes et motifs des propositions sont dessinés pour cette étude ; aucune référence graphique concurrente n’a servi de modèle. Une originalité de conception ne constitue pas une recherche d’antériorité de marque. La finalisation de l’identité attend le choix de direction.
