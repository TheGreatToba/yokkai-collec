# Profil avec tableau et onglets

La page profil présente le Tableau, l’Activité, la Wishlist, les Amis et la Complétion à gauche. L’identité, la date d’inscription et les statistiques occupent un panneau à droite sur ordinateur et passent au-dessus sur mobile.

Le Tableau permet de saisir jusqu’à douze favoris par section : animes/mangas, jeux, K-pop et autres. Chaque titre comporte au maximum 100 caractères. La sauvegarde concerne exclusivement le compte connecté. La vitrine de cinq cartes et l’éditeur existant sont conservés.

`get_profile_details` appelle d’abord `get_profile`. Les comptes dont la collection est privée conservent les restrictions existantes pour les statistiques, l’activité et les classeurs favoris ; la liste d’amis et les amis en commun suivent `friendsVisible`. Aucune permission directe supplémentaire sur les tables n’est accordée.

Le nombre de boosters combine le compteur des boosters réguliers et les ouvertures enregistrées de boosters décisifs. LR et SSR comptent les exemplaires actuellement possédés, y compris Shiny. La complétion compte les cartes distinctes, toutes licences secondaires comprises.

L’activité présente jusqu’à vingt acquisitions encore dans la collection et achats/ventes terminés enregistrés. Les prix ne sont pas affichés pour les acquisitions ordinaires. La date des ventes est celle de fin d’enchère. Les cartes détruites ne fournissent pas d’historique d’acquisition ; cette refonte ne crée pas de faux historique pour celles-ci.

## Test local

`/design-system/profile-preview` fournit un aperçu interactif avec des données de démonstration. `?visitor=1` montre le profil visité et les amis en commun ; `?visitor=1&private=1` vérifie l’affichage privé. Le tableau de démonstration peut être modifié pendant la session sans écrire dans la base.

Migration requise pour les données réelles : `20261014000006_profile_dashboard.sql`. Elle n’est pas appliquée sur le VPS pendant le test local. La base connectée par l’environnement local étant celle de production, l’application de la migration sera faite lors de la mise en production autorisée.
