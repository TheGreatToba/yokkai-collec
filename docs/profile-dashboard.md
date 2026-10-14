# Profil avec tableau et onglets

L’identité, la date d’inscription et les statistiques occupent un panneau à gauche sur ordinateur et passent au-dessus sur mobile. Les onglets à droite sont dans l’ordre : Tableau, Mur, Activité, Wishlist, puis Amis si visible. La page atteint 1440 px sur grand écran et le panneau gauche mesure de 360 à 440 px selon la largeur disponible ; sa bannière atteint 190 px et ses textes sont agrandis sur ordinateur, sans réduire l’espace du contenu à droite.

Dans l’onglet Tableau, la vitrine « Cartes mises en avant » apparaît en premier, puis « Complétion » avec la progression des classeurs favoris. Cet ordre est identique dans le DOM, sur ordinateur et sur mobile. Les deux colonnes partagent la même hauteur sur ordinateur : le bas de la fiche profil reste aligné avec celui du contenu à droite. La grille s’adapte au contenu sans hauteur fixe. Les compteurs Cartes/Différentes/Vues du profil/Likes apparaissent juste sous les actions, suivis des boosters et LR/SSR. La date « Membre depuis » termine la fiche et reste ancrée en bas dans le Tableau. Les autres onglets conservent leur panneau sticky ; le mobile garde deux blocs superposés de hauteur naturelle. Les nombres d’amis et de cartes recherchées restent dans leurs onglets ; les accès à la collection et à la wishlist complète d’un ami sont conservés.

## Ventes dans Activité

L’onglet Activité commence par les cartes actuellement en vente du joueur, puis conserve l’historique des acquisitions/achats/ventes. Les ventes sont chargées uniquement à l’ouverture de l’onglet, par pages de 20, filtrées par vendeur côté serveur et limitées aux enchères actives non échues. Le bouton Actualiser recharge la première page ; Voir plus utilise un curseur immuable date de création/ID.

Un clic ouvre une modale compacte sur place réutilisant `AuctionView` : prix, temps restant, mise rapide ou montant libre, solde, suivi, historique et chat. Les RPC du marché restent inchangés et seuls responsables des fonds, des droits et de l’anti-sniping. Le vendeur ne peut pas miser sur sa propre carte ; il peut confirmer son retrait si aucune offre n’existe. Une vente terminée devient non enchérissable. La modale actualise ses données toutes les trois secondes seulement quand la page est visible et arrête ses lectures à la fermeture. Les écritures sont verrouillées et un échec de relecture après une mise réussie n’est pas présenté comme un échec de mise.

Le flux vendeur respecte la confidentialité de la collection, les amis acceptés, les blocages bilatéraux et les gardes de suppression de compte. Aucun historique privé ni solde du vendeur n’est exposé. Migration `20261015000000_profile_active_auctions.sql` : nouvelle RPC de lecture uniquement, authenticated ; NON appliquée sur le VPS. L’aperçu local simule toutes les ventes, mises, suivis, retraits et messages sans écriture en production (`salesEmpty=1`, `salesError=1`, `auctionClosed=1`, `auctionError=1` pour les cas limites).

## Likes et vues

Sur le profil d’un autre joueur, le menu « … » se trouve à droite du pseudo, sur ordinateur comme sur mobile. Ses actions Signaler et Bloquer sont conservées ; le bouton d’amitié reste sous la biographie.

Le compteur « Voir la collection » retrouve un contour doré au survol, ainsi qu’un repère de focus clavier, sans modifier l’alignement des compteurs.

Le nombre de boosters ouverts apparaît sous son libellé, aligné à gauche comme les compteurs LR/SSR. Après transmission réussie d’un signalement, la notification partagée des paramètres apparaît en bas à droite : « Merci, ton signalement a été transmis. ». Une erreur conserve la modale et n’affiche pas de confirmation.

Un utilisateur connecté peut aimer le profil d’un autre joueur et retirer son like. Il ne peut pas aimer son propre profil ; une contrainte unique par paire empêche les likes multiples. Les vues sont comptées à chaque nouvelle ouverture du profil d’un autre joueur, pas au changement d’onglet ni au rendu React. Une clé de visite empêche les retries et StrictMode de compter deux fois la même ouverture. Les visites à son propre profil ne comptent pas. Les écritures sont refusées entre utilisateurs bloqués, dans les deux sens.

Les RPC ne retournent que les totaux et le statut du like du demandeur. Les tables ne sont pas accessibles directement aux joueurs. Le stockage des vues est borné à une ligne par paire visiteur/profil et aux 64 clés les plus récentes, avec compteur agrégé ; aucun journal illimité par passage. Les données des deux côtés sont supprimées par cascade lors de la suppression d’un compte et protégées par les verrous/tombstones existants. L’export personnel inclut ses likes envoyés, ses visites et les compteurs de son profil, sans dévoiler les identifiants techniques de visite ni la liste des visiteurs reçus. Après suppression d’un visiteur, ses contributions disparaissent des totaux.

Le Tableau affiche la vitrine de cinq cartes puis la complétion des classeurs favoris de l’utilisateur : cartes distinctes possédées / total, pourcentage, barre de progression et nombre de favoris complétés. Les anciens widgets personnalisables et leur bouton d’édition sont retirés du profil. Les données déjà enregistrées ne sont pas supprimées.

Les anciennes préférences, RPC et protections d’export restent conservées pour compatibilité, ainsi que tous leurs tests. Leur éditeur n’est disponible que dans le harness de tests mocké `?catalogue=demo&widgets=1`, jamais activé par l’adaptateur du profil réel.

L’éditeur du profil propose aussi l’import d’une bannière JPG/PNG/WebP/GIF de 2 Mo maximum, depuis un ordinateur ou un téléphone, avec aperçu et suppression. Elle remplace le personnage de bannière, qui reste disponible comme alternative. Les fichiers utilisent le dossier du propriétaire dans le bucket `avatars`, ses règles existantes et son nettoyage lors de la suppression du compte. Le RPC d’apparence réutilise les validations existantes du profil et enregistre les changements atomiquement. Aucune URL externe de bannière n’est acceptée ; seul le fichier raster `banner` du compte connecté sur l’API est autorisé.

`get_profile_details` appelle d’abord `get_profile`. Les comptes dont la collection est privée conservent les restrictions existantes pour les statistiques, l’activité et les classeurs favoris ; la liste d’amis et les amis en commun suivent `friendsVisible`. Aucune permission directe supplémentaire sur les tables n’est accordée.

Le nombre de boosters combine le compteur des boosters réguliers et les ouvertures enregistrées de boosters décisifs. LR et SSR comptent les exemplaires actuellement possédés, y compris Shiny. La complétion compte les cartes distinctes, toutes licences secondaires comprises.

L’activité présente jusqu’à vingt acquisitions encore dans la collection et achats/ventes terminés enregistrés. Les prix ne sont pas affichés pour les acquisitions ordinaires. La date des ventes est celle de fin d’enchère. Les cartes détruites ne fournissent pas d’historique d’acquisition ; cette refonte ne crée pas de faux historique pour celles-ci.

## Test local

`/design-system/profile-preview` fournit un profil de démonstration sans écriture réelle. `?visitor=1` montre le profil visité et les amis en commun ; `?visitor=1&private=1` vérifie l’affichage privé. `?favorites=empty` vérifie les favoris vides. La bannière peut être modifiée temporairement pendant la session ; les fichiers importés utilisent des URL locales libérées à la fermeture. Le mode normal n’affiche aucun widget. `?catalogue=demo&widgets=1` est réservé aux tests de compatibilité de l’ancien éditeur et ne lit ni n’écrit le catalogue réel.

Migrations requises : `20261014000006_profile_dashboard.sql` et `20261014000007_profile_wall.sql`. Elles ne sont pas appliquées sur le VPS pendant les tests locaux. Le mur et ses permissions sont détaillés dans [profile-wall.md](profile-wall.md).
