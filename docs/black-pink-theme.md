# Essai local — Yokkai noir et rose

Proposition visuelle sur `ad/black-pink-theme`, basée sur la production. Pas de livraison en production sans validation de l’essai.

- Logo fourni par l’utilisateur, conservé sans retouche dans `public/assets/brand-logo-pink.png` ; même ratio sur l’accueil, l’authentification et la navigation.
- Palette partagée noir / charbon, accent rose `#F94D95`, secondaires rose pâle et texte blanc cassé. Les noms techniques historiques `accent-gold` et `accent-neon` restent compatibles avec les composants existants.
- Boutons principaux, focus clavier, sélection, navigation, monnaie, progression, halos et panneaux de boosters harmonisés. Les images de pochettes restent inchangées.
- Couleurs des raretés C/R/SR/SSR/LR, apparence Shiny, couleurs de succès/erreur, taux de drop, ouverture et logique métier inchangés.
- Aucune migration Supabase ; rien à appliquer sur le VPS.

## Contrats de tests existants

Les tests existants ne sont ni modifiés ni assouplis. `tests/ui-presentation.test.mjs` impose le logo doré et les anciennes largeurs ; `tests/booster-shared-theme.test.mjs` impose le thème bleu/lavande. Leurs assertions visuelles doivent donc échouer sur cette proposition. Avant toute livraison de ce nouveau choix produit, prévoir une PR de tests séparée et la validation de Walid pour leur remplacement.

`tests/black-pink-theme.test.mjs` ajoute des vérifications indépendantes pour le ratio du nouveau logo, le contraste, les états pressés et la conservation des raretés et états sémantiques.
