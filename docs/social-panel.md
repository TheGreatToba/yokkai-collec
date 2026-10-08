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
- Le plafond est de 10 créations par joueur et par jour UTC, pas de 10 liens actifs.
  Supprimer puis recréer un partage consomme une nouvelle création. La même combinaison
  carte/Shiny/affichage du pseudo réutilise un lien encore existant sans consommer ce plafond.
  Les événements de création sont conservés indépendamment des suppressions ; ceux du joueur
  de plus de 7 jours sont nettoyés dans la fonction de création, sans tâche planifiée.
- La carte partagée se rattache au catalogue `cards`, lisible par `anon`. Le catalogue et ses
  identifiants restent donc récupérables à partir des données publiques.
- La page publique valide l'illustration comme le rendu social : HTTPS, origine Supabase exacte
  et préfixe du bucket `card-images`. Sinon, elle montre un cadre avec le nom de la carte.
- Les images sociales ne sont pas stockées dans Supabase Storage : Next.js les produit avec
  `ImageResponse`, les conserve dans un cache mémoire LRU borné à 32 Mio et mutualise les rendus
  simultanés d'une même image.
- Les PNG ont un cache HTTP `public, max-age=300, must-revalidate`, sans `immutable` : cinq
  minutes limitent les requêtes répétées tout en bornant la fraîcheur après suppression.
  Chaque requête d'image atteignant Next.js vérifie le partage par un appel RPC à la base avant
  toute lecture du cache mémoire (un appel SQL par image servie par le serveur). Une réponse
  servie par un cache HTTP ne consulte pas la base. La page est dynamique et sans stockage HTTP
  (`private, no-cache, no-store, max-age=0, must-revalidate`). Les 404 d'image restent `no-store`.
  Les copies reçues avant cette politique peuvent suivre l'ancien en-tête jusqu'à expiration.
- Un joueur peut supprimer ses liens. La prochaine requête d'image au serveur répond alors 404 ;
  une copie HTTP encore fraîche peut rester visible jusqu'à 300 secondes. Discord et WhatsApp
  conservent leur propre copie de l'aperçu après suppression : supprimer le partage n'efface pas
  ces copies et l'application ne contrôle pas leur durée de conservation.
- Limite connue de Next.js 16 : pour un partage inconnu, la page « introuvable » et sa balise
  `noindex` sont bien rendues, mais le shell diffusé avant la vérification conserve le statut HTTP
  200. Les routes d'image vérifient l'existence avant tout rendu et répondent, elles, avec un vrai
  statut HTTP 404. Le proxy ne fait volontairement aucune requête supplémentaire à la base.
