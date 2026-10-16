# Essai local : pochette céleste et déchirure dorée

- Le Decision Pack utilise `Pochette_celeste_YOKKAI_COLLEC.png`, fourni par Abdou, sous le chemin existant `public/assets/decision-booster-pack.png`. Le Regular Pack conserve son visuel.
- L'ouverture des deux packs reprend le haut découpé en zigzag, le halo et les 16 scintillements de `yokkai_dechirure_scintillement_dore.html`. Le HTML fourni sert de référence visuelle : aucun document embarqué, script externe, image base64 ou vidéo n'est exécuté dans le site.
- Deux exemplaires du même visuel sont découpés en CSS. Seule la bande supérieure se détache pendant la phase `seal`, une seule fois. Le corps reste en place jusqu'à la révélation des cartes.
- Durées centralisées, attente de la réponse serveur, verrou anti-double ouverture, préchargement des cartes, contrôle clavier et possibilité de passer inchangés. Le mode mouvements réduits désactive les nouveaux mouvements.
- Aucun changement des révélations SR/SSR/LR/Shiny, des taux, des RPC ou des récompenses. Aucune migration.

## Essai sans consommer de vrai pack

Ouvrir `http://localhost:3000/design-system/boosters-preview`, puis cliquer sur `Open` pour le Regular Pack ou le Decision Pack. Recharger pour recommencer avec des réserves simulées.

`scripts/browser-proof-pack-tear.mjs` vérifie les deux packs à 1440 et 390 px, la bande mobile et le corps fixe, la révélation, le mode mouvements réduits et l'absence de mutations de packs réels. Captures dans `artifacts/pack-tear/`.

Cet essai n'est pas autorisé à être fusionné ou déployé sans validation d'Abdou.
