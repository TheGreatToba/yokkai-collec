# Nouvelle page Boosters — design seul

Branche créée depuis `origin/master`, sans les commits d’animations de la PR #262.

- Présentation violet/or, socles lumineux et informations compactes.
- Deux panneaux alignés sur ordinateur, une colonne sur mobile.
- Nouveau titre et introduction en anglais sur la vraie page du jeu.
- Focus clavier, boutons désactivés et mouvement réduit conservés.

La feuille `styles/boosters-showcase.css` cible uniquement la sélection des packs.
Les fichiers `components/boosters.tsx`, `styles/boosters.css` et la route
`app/boosters/page.tsx` restent identiques à master. Les animations d’ouverture
et de révélation actuelles, les taux de drop, les réserves et les RPC ne changent pas.

Aucune nouvelle animation native, vidéo, comparaison Before/After, route de test
ou carte garantie n’est incluse. Les travaux d’animations restent sur
`ad/native-drop-effects` et ne sont pas à merger avec cette PR.

Migrations Supabase : aucune. Aucun changement de base ou de VPS nécessaire.
