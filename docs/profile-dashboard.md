# Profil avec tableau et onglets

L’identité, la date d’inscription et les statistiques occupent un panneau à gauche sur ordinateur et passent au-dessus sur mobile. Le Tableau, l’Activité, la Wishlist, les Amis et la Complétion sont à droite.

Le Tableau permet de choisir jusqu’à douze widgets parmi toutes les catégories réellement présentes dans le catalogue. Les widgets peuvent être ajoutés, retirés et réordonnés. Chacun contient jusqu’à douze favoris de 100 caractères. La sauvegarde concerne exclusivement le compte connecté. Ces préférences sont incluses dans son export de données personnelles, avec les protections existantes. La vitrine de cinq cartes est conservée. L’ancien RPC de préférences reste compatible.

L’éditeur du profil propose aussi l’import d’une bannière JPG/PNG/WebP/GIF de 2 Mo maximum, depuis un ordinateur ou un téléphone, avec aperçu et suppression. Elle remplace le personnage de bannière, qui reste disponible comme alternative. Les fichiers utilisent le dossier du propriétaire dans le bucket `avatars`, ses règles existantes et son nettoyage lors de la suppression du compte. Le RPC d’apparence réutilise les validations existantes du profil et enregistre les changements atomiquement. Aucune URL externe de bannière n’est acceptée ; seul le fichier raster `banner` du compte connecté sur l’API est autorisé.

`get_profile_details` appelle d’abord `get_profile`. Les comptes dont la collection est privée conservent les restrictions existantes pour les statistiques, l’activité et les classeurs favoris ; la liste d’amis et les amis en commun suivent `friendsVisible`. Aucune permission directe supplémentaire sur les tables n’est accordée.

Le nombre de boosters combine le compteur des boosters réguliers et les ouvertures enregistrées de boosters décisifs. LR et SSR comptent les exemplaires actuellement possédés, y compris Shiny. La complétion compte les cartes distinctes, toutes licences secondaires comprises.

L’activité présente jusqu’à vingt acquisitions encore dans la collection et achats/ventes terminés enregistrés. Les prix ne sont pas affichés pour les acquisitions ordinaires. La date des ventes est celle de fin d’enchère. Les cartes détruites ne fournissent pas d’historique d’acquisition ; cette refonte ne crée pas de faux historique pour celles-ci.

## Test local

`/design-system/profile-preview` fournit un aperçu interactif avec des données de démonstration. `?visitor=1` montre le profil visité et les amis en commun ; `?visitor=1&private=1` vérifie l’affichage privé. Le tableau et la bannière de démonstration peuvent être modifiés pendant la session sans écrire dans la base ni dans le stockage. Les fichiers importés en aperçu sont des URL locales temporaires, libérées à la fermeture de la page.

Migration requise pour les données réelles : `20261014000006_profile_dashboard.sql`. Elle n’est pas appliquée sur le VPS pendant le test local. La base connectée par l’environnement local étant celle de production, l’application de la migration sera faite lors de la mise en production autorisée.
