# Solar Eclipse & Golden Talisman

Yokkai Collec’ · Proposition visuelle unique · Phase 1 · 16 octobre 2026

## Intention

**Des fragments de culture pop transformés en talismans célestes.** Walid a retenu l’univers mystique de l’éclipse décrit dans la proposition Gemini, sans avoir choisi un rendu graphique existant. Cette étude matérialise cet univers : nuit noire, couronne solaire, horlogerie astronomique, gravure et montures précieuses. Ce n’est pas une nouvelle sélection de trois pistes.

[Ouvrir la maquette](index.html)

L’écran de collection doit donner envie d’entrer avant toute animation. L’éclipse crée une présence ; les cartes portent le désir de possession ; le reste de l’interface garde une lecture calme. Le relief vient des matières et des assemblages, sans imposer un traitement fantasy aux photos ou aux dessins.

## Charte proposée

| Rôle                | Couleur   | Règle                                       |
| ------------------- | --------- | ------------------------------------------- |
| Nuit                | `#050508` | Fond principal, très peu éclairé            |
| Plaque d’obsidienne | `#0E0F17` | Surfaces, cartouches et navigation          |
| Surface relevée     | `#17171D` | Fenêtre d’image et plans secondaires        |
| Bronze de structure | `#38302A` | Séparation uniquement, pas texte            |
| Or solaire          | `#D4AF37` | Identité, repères et accent                 |
| Blanc de couronne   | `#F5E6AB` | Titres accentués et lumière chaude          |
| Texte               | `#FAFAFC` | Lecture courante et noms                    |
| Texte secondaire    | `#B1A9A0` | Métadonnées sur surfaces opaques            |
| Incandescence       | `#E65C00` | Matière du reliquaire, jamais texte courant |
| Texte incandescent  | `#FFB478` | Variante lisible pour un éventuel statut    |

**Typographie.** Syne 600/700/800 pour identité et titres, Outfit 400/500/600 pour interface et noms propres. Unbounded 600/700 intervient seulement sur les codes de rareté et quelques légendes courtes. Ces familles sont proposées par Gemini ; leur licence SIL OFL est vérifiée dans le dépôt officiel Google Fonts. Pour le produit : auto-hébergement et limitation aux graisses effectivement utilisées. Les noms japonais/coréens conservent leurs caractères avec une fonte de repli appropriée.

**Logo.** Un disque d’éclipse ouvert sur une couronne asymétrique, traversé par un Y gravé, avec des repères astronomiques extérieurs. Le dessin est original et vectoriel (`assets/logo.svg`). Le mot-symbole Syne est volontairement contemporain : le mystère appartient aux objets et aux signes, pas à une police médiévale. Il n’y a pas de mascotte à cette étape.

**Karas.** Pièce à double cerclage, étoile à quatre branches et cœur gravé, dessinée en SVG. Le montant est accompagné du mot Karas ; l’icône ne porte pas seule le sens. Aucun lien avec une valeur monétaire réelle.

**Grammaire graphique.** Trois motifs seulement : couronne d’éclipse, graduations d’astrolabe, griffes de sertissage. Les lignes sont fines et interrompues ; les ombres restent noires ; les reflets sont chauds. Les grands cercles ne deviennent pas des fonds omniprésents dans le marché, les paramètres ou les tableaux de données.

## Cartes : la baie saphir devient un contrat de rendu

Ratio extérieur **5:7**, conservé pour la compatibilité avec l’existant. Une monture en trois zones indépendantes : rail opaque de rareté, fenêtre d’image et cartouche opaque nom/franchise. L’image est enchâssée, pas assombrie par un masque noir.

- `object-fit: contain` par défaut : carré clair, portrait sombre, dessin et photographie gardent leur composition. Les marges prennent un basalte neutre. Les veines d’or et la micro-gravure appartiennent à la monture, pas au fond de chaque photo.
- Pas de filtre coloré universel, de flou agrandi ou de dégradé sur les visages. Le masque se limite aux coins de la fenêtre ; le reflet Shiny se limite à ses bords.
- Un recadrage `cover` n’est envisageable qu’avec un point focal validé pour l’image concernée. Il n’est pas employé sur les cartes de cette proposition.
- Nom et franchise restent hors illustration. En production : deux lignes maximum en vignette, nom complet en détail/zoom et dans le nom accessible. Aucune traduction des noms propres.
- Le même découpage sert aux tailles vignette, détail, zoom et image OG, avec effets statiques en OG. Une image manquante conservera l’espace, le nom et la rareté avec un signe original de repli ; cette logique ne fait pas partie du HTML statique d’étude.

| Rareté            | Silhouette et ornement, sans dépendre de la couleur                               | Matière           |
| ----------------- | --------------------------------------------------------------------------------- | ----------------- |
| C                 | Monture fine, coins doux, une phase                                               | Basalte mat       |
| R                 | Cerclage gravé de graduations, deux phases                                        | Acier météorique  |
| SR                | Quatre griffes joaillières, trois phases                                          | Platine           |
| SSR               | Double gorge et rayons dans les angles, quatre phases                             | Or solaire        |
| LR                | Monture plus épaisse, couronne axiale découpée et repères rayonnants, cinq phases | Or massif sculpté |
| LR Shiny          | Même profil LR, nacre claire, rail clair, sceau S et `Shiny · Direct pull`        | Nacre céleste     |
| SSR Shiny évoluée | Profil SSR, nacre claire, sceau S et `Shiny · Evolved`                            | Nacre céleste     |

Les codes C/R/SR/SSR/LR restent visibles et n’acquièrent pas de nouvelles significations métier. Shiny reste une variante : tirage direct uniquement pour LR, évolution par doublons pour SSR. Le LR normal est présenté en grand ; les Shiny sont visibles dans la grille pour que leur différence existe même sans animation. Vesper SR/LR/LR Shiny partage la même illustration : on peut ainsi juger la monture seule.

La reconnaissance en moins d’une seconde reste à confirmer avec des joueurs, notamment à environ 130 px et en niveaux de gris. Protocole proposé : grille présentée une seconde, puis masquée, identification LR/Shiny ; cible de 90 % de bonnes réponses avant intégration.

## Objets du rituel

**Regular Pack : l’écrin.** Coffret d’obsidienne à bandeau d’or et fermeture centrale estampée d’un astrolabe. Forme rectangulaire, nom explicite, cinq cartes conservées, stock de cinq et recharge régulière inchangés.

**Decision Pack : le reliquaire solaire.** Cylindre noir, cœur d’éclipse incandescent et bagues métalliques. La forme distingue immédiatement le rendez-vous quotidien, même sans couleur. Cinq cartes révélées, une gardée, les autres rapportent des Karas ; un pack par jour.

**Dos.** Astrolabe gravé sur laque noire, anneaux interrompus, graduations, ellipse inclinée et étoile centrale. C’est un dessin SVG original, pas un asset généré ou un dos dérivé d’un jeu existant.

Les objets de la maquette sont des études CSS/SVG, pas des assets de production définitifs. Le reliquaire reçoit une incision lumineuse statique : pas de pulsation indispensable à son identification.

## Mouvement futur

La charte doit fonctionner immobile. Le produit pourra ajouter un reflet de saphir unique sur la seule carte active, 160–220 ms ; une arrivée mécanique des griffes en 250–450 ms ; l’assemblage de la monture LR en 650 ms ; un reflet nacré unique de 900 ms pour Shiny. Pas de roue SVG tournant en permanence derrière chaque vignette.

L’ouverture future suit la même logique : déverrouillage feutré, apparition des cinq cartes, révélation adaptée à la rareté ; le Decision conserve sa sélection lisible et la conversion des quatre cartes. Aucun flash stroboscopique. `Skip animation` disponible immédiatement. Sous `prefers-reduced-motion`, les cartes arrivent directement dans leur état final avec les mêmes noms, raretés et annonces.

Les maquettes de cette phase n’animent aucun élément ; leur seul défilement doux devient instantané avec cette préférence. Aucun framework d’animation, canvas, vidéo ou nouvelle dépendance.

## Accessibilité et validation

Le contrôle `check-solar.py` calcule le contraste sRGB des rôles de texte sur les surfaces opaques, des boutons sur les extrémités de leur dégradé et des badges de rareté. Focus de 3 px avec décalage, lien d’évitement, cibles principales de 44 px et libellés anglais. Les couleurs de bronze et les filaments de la couronne sont décoratifs, pas des textes certifiés.

Les captures et mesures de navigateur sont consignées dans `VALIDATION.md`. Les tests de perception artistique, de lecture en une seconde et l’audit complet de lecteur d’écran ne sont pas présentés comme acquis. Les chiffres de collection sont fictifs et les liens Market/Friends renvoient aux notes d’étude.

## Limites de cette proposition

L’éclipse est un décor bitmap original généré pour cette étude ; toutes les lettres, commandes, montures, cartes et motifs d’astrolabe sont du vrai HTML/CSS/SVG. Le décor est encodé en WebP (96 152 octets), sans animation ; les deux illustrations locales réutilisées pèsent 335 870 octets au total. Les deux photos et les fontes se chargent à distance dans la maquette. Leur provenance et les prompts sont dans [ASSETS.md](ASSETS.md).

L’étude reprend le **concept écrit** de Solar Eclipse transmis par Walid. Elle ne prétend pas reproduire une image Gemini qu’il aurait sélectionnée. Les anciens univers et leurs couleurs ne sont pas intégrés à cette branche. Aucune route, variable de production, règle métier, migration ou test existant n’est modifié.

## Après validation visuelle seulement

1. Tokens et typographie, en remappant les alias Tailwind/CSS existants sans casser leurs consommateurs ; logo horizontal/icône/mono, favicon, app icon, OG par défaut et Karas.
2. Composants de base, puis navigation/modales/toasts/vides/erreurs/chargements en sous-PR si nécessaire ; API et comportements accessibles préservés.
3. Cartes et dos, les sept cadres, tailles et états locked/auction/wishlist/new, image OG de carte et matrice photo/dessin/claire/sombre.
4. Visuels de boosters, puis ouverture dans une PR séparée ; aucune modification des quotas, stocks ou probabilités.
5. Pages par groupes : collection/catalogue ; marché ; échanges ; profils/amis/succès ; notifications ; pages publiques/auth/paramètres.

Chaque PR sera compatible avec la précédente, mettra à jour `/design-system` et `docs/BRAND.md`, indiquera ses migrations Supabase et contiendra des captures avant/après à 390 et 1440 px. Format avant commit, hooks actifs, aucune CI complète locale et aucun test affaibli ; merge uniquement avec CI GitHub verte sur une branche à jour. Ce prototype n’autorise ni déploiement ni lancement automatique de la phase 2.

## Sources des fontes

[Syne / OFL](https://github.com/google/fonts/blob/main/ofl/syne/OFL.txt), [Outfit / OFL](https://github.com/google/fonts/blob/main/ofl/outfit/OFL.txt), [Unbounded / OFL](https://github.com/google/fonts/blob/main/ofl/unbounded/OFL.txt).
