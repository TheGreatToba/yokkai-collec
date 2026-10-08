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
- La feuille de partage est accessible depuis le détail d'une carte possédée et depuis le reveal
  final des SSR, LR ou Shiny conservées. L'option « Afficher mon pseudo » est décochée par défaut.
  Elle propose le lien, le partage natif et les téléchargements story/carré. La Collection donne
  accès à « Mes liens partagés », avec suppression confirmée et liste réservée au propriétaire.
- Les champs visibles d'un partage sont figés à sa création : nom, franchise, rareté, statut
  Shiny, illustration du catalogue et, seulement avec accord explicite, pseudo du joueur.
- Un joueur peut créer au plus 10 nouveaux liens par jour UTC. Recréer la même combinaison
  carte/Shiny/affichage du pseudo réutilise le lien existant sans consommer ce plafond.
- Les images sociales ne sont pas stockées dans Supabase Storage : Next.js les produit avec
  `ImageResponse`, les conserve dans un cache mémoire LRU borné à 32 Mio et mutualise les rendus
  simultanés d'une même image.
- Un joueur peut supprimer ses liens. La page et les routes d'image répondent alors 404, mais les
  aperçus déjà mis en cache par Discord, WhatsApp ou X peuvent rester visibles quelque temps.
- Limite connue de Next.js 16 : pour un partage inconnu, la page « introuvable » et sa balise
  `noindex` sont bien rendues, mais le shell diffusé avant la vérification conserve le statut HTTP
  200. Les routes d'image vérifient l'existence avant tout rendu et répondent, elles, avec un vrai
  statut HTTP 404. Le proxy ne fait volontairement aucune requête supplémentaire à la base.
