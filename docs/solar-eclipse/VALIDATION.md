# Validation — Solar Eclipse

Contrôle ciblé : `python docs/solar-eclipse/check-solar.py`.

- Minimum des paires de texte/bouton vérifiées : **7,69:1**.
- Texte principal, secondaire, or, couronne et ember lisible vérifiés sur fond, surface et surface relevée ; texte du bouton sur les deux extrémités du dégradé.
- Toutes les couleurs de code de rareté vérifiées sur le rail opaque, ainsi que le rail clair Shiny.
- Un h1, huit spécimens (sept cadres et une LR de vitrine), documents anglais, assets locaux et dimensions d’images, absence de script.
- Cadres et motifs CSS/SVG, trois WebP locaux pour un total de **432 022 octets**, dont 96 152 octets pour l’éclipse. Aucune nouvelle dépendance ni animation vidéo.

Inspection du navigateur réel : capture desktop 1440 × 1100 (`assets/desktop.png`) et mobile 390 × 844 (`assets/mobile.png`). Mesures de document à 320, 390, 768, 1024 et 1440 px, sans débordement horizontal ; deux, quatre puis sept colonnes. Les valeurs brutes sont dans `layout-audit.json`.

Le focus clavier du lien de navigation est vérifié à 3 px. La règle de mouvement réduit est présente ; aucune émulation de préférence système ni certification de lecteur d’écran complet n’est annoncée.

Les contrastes mesurés portent sur les surfaces opaques déclarées. L’éclipse et les gravures sont décoratives ; la revue du contraste de toutes les variantes de fond et états du produit restera à faire en phase 2. La reconnaissance en une seconde n’est pas considérée testée auprès de joueurs.

La maquette ne consomme ni pack ni Karas et n’accède à aucune donnée Supabase. Les chiffres sont fictifs. Les ancres Market/Friends mènent aux notes d’étude. Polices et photographies nécessitent une connexion Internet ; la gestion métier des images manquantes reste hors de cette étude statique.

Aucun code de production ni test existant modifié ; aucune migration ; aucune CI complète exécutée localement. Le statut de la PR fait foi pour les vérifications GitHub.
