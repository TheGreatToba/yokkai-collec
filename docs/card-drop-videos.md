# Vidéos de drop SR / SSR / LR

Les trois originaux fournis par l’utilisateur sont copiés sans recompression dans
`public/assets/drops/` : H.264, 1280 × 720, 10,005 s, environ 1,7 / 3 / 4 Mo.
Leur piste audio reste muette ; les bruitages existants conservent leur réglage
et n’interrompent pas la musique du téléphone.

## La vraie carte, pas le personnage de la vidéo

Les MP4 sont déjà composés avec une carte illustrée. L’utilisateur a explicitement
refusé d’afficher ces personnages. Un masque central permanent (32 % × 84 % du
cadre 16:9) retire toute la zone contenant la carte incrustée, y compris son dos
et sa rotation. La vraie carte du tirage est rendue séparément avec `CardBack`,
puis `YokaiCard`, à un instant adapté au clip.

Le masque enlève aussi les effets derrière la carte d’origine : les MP4 ne
contiennent pas de calque « effets seuls ». Les effets extérieurs sont conservés.
Le cadrage reste identique sur mobile (`contain`), sans recadrage du masque.
Si le navigateur ne gère pas ce masque, aucune vidéo n’est chargée ou affichée.

## Replis et sécurité du reveal

- La fin de lecture, « Skip animation », Échap et la fermeture affichent la carte.
- Une erreur, une lecture refusée, 6 s sans progression ou un délai total de 18 s
  terminent la cinématique. Le reveal ne peut pas rester bloqué.
- Mouvement réduit et économie de données contournent la vidéo sans téléchargement.
- Un verrou synchrone empêche plusieurs lancements et une double finalisation.
- Les anciennes cinématiques CSS SR/SSR/LR ne se rejouent pas après la vidéo.
- Les cartes C/R ne chargent pas de vidéo. Taux et résultats des tirages inchangés.
- Les LR/Shiny conservent leur modale de contemplation après la cinématique.
- La sélection et les actions du Decision Pack ne changent pas.

## Validation

Contrat de tests existants modifié dans une PR séparée validée avec Walid.
Nouveaux tests de mappage, intégrité des MP4, masque et replis. Aperçu local sans
RPC : `/design-system/card-drop-preview`.

Migrations Supabase : aucune. Aucun changement appliqué sur le VPS.
