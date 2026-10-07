# Feuille de route du panneau social

## Étapes prévues

1. Amis privés — cette PR
2. Partage de carte
3. Blocage et signalement
4. Likes de profil
5. Boucle d'échange : doublons à échanger, correspondance avec la wishlist et message dans l'offre
6. Présence en ligne
7. Plus tard : fil d'activité, classements, invitation et webhook Discord

## Décisions prises

- Tout joueur connecté peut liker un profil, avec un seul like par joueur et un plafond quotidien.
- L'historique des likes n'est visible que par le propriétaire du profil.
- La liste et le nombre d'amis ne sont visibles que par le propriétaire, sur son profil et sur /amis, indépendamment de la confidentialité de sa collection.
- Un visiteur, même ami du propriétaire, ne voit ni tuile ni colonne Amis. Aucun élément ne les remplace dans cette PR.
- Une future PR ajoutera un compteur de likes sur le profil public ; aucun compteur d'amis n'est public.
- La présence en ligne n'est visible que par les amis, sans compteur global.
- Un réglage permet d'« apparaître hors ligne ».
- La page publique d'une carte partagée est visible sans compte.
- Au moment du partage, une option cochée permet d'afficher le pseudo sur cette page.
- La page publique d'une carte partagée n'affiche jamais d'image personnalisée.
