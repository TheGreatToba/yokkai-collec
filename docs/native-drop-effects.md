# Drop natif SR / SSR / LR

Les MP4 fournis sont uniquement des références visuelles. Aucun fichier vidéo,
lecteur, masque d’image ou bouton « passer » n’est intégré au drop.

Les effets sont rendus en CSS sur la vraie carte du tirage :

- SR : halo violet, petites étoiles et bord lumineux ;
- SSR : retournement 3D, rubans-comètes roses et explosion de pétales ;
- LR : anticipation violette, retournement 3D, rayons dorés et poussière d’étoiles.

Les éléments SVG/particules du moteur existant sont conservés. La feuille native
est importée après la base, avec des sélecteurs limités aux drops SR/SSR/LR.
Les images de cartes ne sont ni remplacées ni incrustées dans un média.

Les durées et le moteur de dépôt restent inchangés (SR 520 ms, SSR 3,2 s, LR
4,4 s). C/R, Shiny, bruitages, Decision Pack et modale LR restent inchangés.
Le mouvement réduit coupe les animations. L’aperçu utilise un vrai visuel de
personnage local : `/design-system/card-drop-preview` (aucune RPC).

L’aperçu propose aussi un pack complet garanti SR + SSR + LR, avec trois
personnages différents (Gojo, Levi, Luffy), ouverture et rejeu en mémoire.
Aucun booster, carte ou Karas réel n’est consommé ou créé.

En développement, `/boosters` propose également un comparateur Before / After
sur le vrai écran d’ouverture, avec un pack SSR Levi + LR Luffy garanti.
Before désactive uniquement les surcharges natives et retrouve la CSS de prod.
`/boosters?live=1` conserve le jeu réel. En production, le comparateur n’est jamais
rendu : authentification et Game restent obligatoires, quels que soient les paramètres.

Les tests existants, y compris le fingerprint du markup du reveal, ne sont pas
modifiés. De nouveaux tests vérifient les effets natifs et l’absence de lecteur.

Les PR vidéo #260/#261 sont abandonnées. Migrations Supabase : aucune.
Aucun changement appliqué sur le VPS, aucun déploiement pour cette étape locale.

## Présentation de la sélection de boosters

La feuille `boosters-showcase.css` retravaille uniquement la sélection des packs :
deux panneaux violet/or, visuels sur socles lumineux, informations compactes et
boutons alignés. Elle ne cible ni le reveal, ni l’ouverture, ni les modales.
Sur mobile, les panneaux passent en une colonne ; focus clavier, bouton désactivé
et mouvement réduit sont conservés. Le comparateur local est dans un panneau
repliable. Aucun changement de taux, de réserve ou de recharge, aucune migration.
