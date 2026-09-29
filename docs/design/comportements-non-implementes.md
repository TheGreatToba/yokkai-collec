# Comportements décrits mais non implémentés

Cette liste conserve des idées présentes dans les maquettes Gemini. Elle ne constitue pas un backlog validé et n’autorise aucune modification de logique métier.

## Gaps fonctionnels à prioriser

Manques qui touchent l’usage réel du jeu, et pas seulement l’habillage. Chacun demande une évolution des données exposées par le serveur, hors du périmètre d’une refonte visuelle.

### Notifications · Le panneau ne se rafraîchit pas à son ouverture

- **Constat** : les notifications sont chargées au montage de la Topbar, puis relues toutes les 10 secondes. Ouvrir le panneau depuis la cloche ne déclenche pas de nouvelle lecture. Le retour sur un onglet redevenu visible ne provoque pas non plus de rafraîchissement immédiat.
- **Impact** : une notification récente peut rester invisible jusqu’au prochain passage du polling. Lorsque le navigateur suspend ou ralentit les timers d’un onglet, elle peut ne devenir visible qu’après un rafraîchissement manuel de la page.
- **Cause** : `getNotifications()` est appelé uniquement par l’effet initial, l’intervalle de polling et le bouton « Réessayer ». L’ouverture du panneau et l’événement `visibilitychange` ne sont pas reliés à cette fonction.
- **Piste** : conserver le polling existant et déclencher une actualisation supplémentaire à l’ouverture du panneau ainsi qu’au retour de visibilité de l’onglet, avec une protection contre les requêtes simultanées.
- **Statut** : non implémenté, car ce correctif modifie le déclenchement des requêtes et dépasse le périmètre strictement visuel de la Phase 8.
- **Source** : constat utilisateur après la Phase 8 · Notifications.

### Marché · Les enchères où l’on a misé sans être en tête sont introuvables

- **Constat** : « Mes enchères › En cours » ne liste que les ventes du joueur et les enchères où il est actuellement en tête. Dès qu’il est surenchéri, l’enchère disparaît de cet onglet alors que sa participation continue.
- **Impact** : un joueur peut perdre le fil de ses propres mises et manquer l’occasion de surenchérir avant la fin. Seule la notification « Tu as été surenchéri » (lien direct vers l’enchère) permet aujourd’hui de la retrouver ; la page détail affiche bien le statut « Surenchéri », mais uniquement une fois ouverte.
- **Cause** : `list_auctions` n’expose que le meilleur enchérisseur (`buyerId`), pas la liste des participants ni la participation du joueur courant.
- **Piste** : exposer les participants (ou un indicateur « a misé » pour le joueur courant) via `list_auctions`, ou ajouter une RPC dédiée du type « mes enchères en tant qu’enchérisseur ». L’interface pourra alors les ajouter à « En cours » avec le statut « Surenchéri », déjà prévu dans `AuctionStatus`.
- **Source** : Phase 6 · Marché, `docs/groupe-3-marche.md` (§ 4.1 « Ventes actives + Enchères posées en tant qu’acheteur »).

## Contrôles et idées de maquette non câblés

| Idée documentaire | Source |
| --- | --- |
| Trier côté serveur les cartes d’un reveal par rareté croissante | `docs/groupe-2-boosters.md` |
| Rediriger automatiquement vers la Collection après validation d’un booster | `docs/groupe-2-boosters.md` |
| Faire voler les cartes conservées vers la navigation et désintégrer les autres | `docs/groupe-2-boosters.md` |
| Convertir automatiquement les quatre cartes non retenues du booster décisif en Karas | `docs/groupe-2-boosters.md` |
| Mettre à jour en temps réel le chrono, l’historique et les offres d’une enchère | `docs/groupe-3-marche.md` |
| Valider dynamiquement la disponibilité du pseudo avec un debounce de 300 ms | `docs/groupe-6-landingpage.md` |
| Imposer un délai minimum de 500 ms à l’état de chargement de connexion | `docs/groupe-6-landingpage.md` |
| Rediriger après inscription et déclencher automatiquement un toast de bienvenue | `docs/groupe-6-landingpage.md` |
| Rafraîchir silencieusement inventaire, solde et notifications après les actions | `docs/groupe-3-marche.md`, `docs/groupe-5-succes-wishlist-notifs.md` |
| Créditer, débiter ou animer un roll-up de Karas à partir des scénarios de maquette | `docs/design_system.md`, `docs/groupe-1-collection-catalogue.md`, `docs/groupe-2-boosters.md`, `docs/groupe-5-succes-wishlist-notifs.md` |
| Charger ou étendre les listes de possesseurs selon les maquettes Catalogue | `docs/groupe-1-collection-catalogue.md` |
| Déduire de nouveaux états de notification, d’amitié ou d’échange non fournis par les données actuelles | `docs/groupe-4-social.md`, `docs/groupe-5-succes-wishlist-notifs.md` |
| Filtrer la Collection par « Type de carte » ; nécessite un type persistant associé à chaque carte du catalogue, exposé par les lectures Collection | Référence visuelle de révision Phase 3 |
| Filtrer la Collection par mode d’acquisition ; nécessite une provenance persistante par exemplaire (booster, échange, marché, évolution, etc.) et son exposition dans les données Collection | Référence visuelle de révision Phase 3 |
| Choisir le tri de la Collection ; nécessite un paramètre de tri transmis à la requête paginée, ou un tri client seulement si l’intégralité des cartes est déjà chargée | Révision Phase 3 |
| Faire de « Ajouter à ma collection » une validation réelle du Regular Pack ; aujourd’hui les cartes sont déjà enregistrées par `openBooster` à l’ouverture, le bouton est donc un lien vers la Collection (désactivé tant que les 5 cartes ne sont pas révélées) | Phase 5 · Boosters |
| Afficher le gain « Détruire (+X Karas) » sous chaque carte ; nécessite d’exposer la valeur de destruction par carte avant l’action (`discardPackCard` ne renvoie que le solde final) | Phase 5 · Boosters, `docs/groupe-2-boosters.md` |
| Annoncer le montant de Karas dans la modale de confirmation du Booster Décisif ; le montant n’est connu qu’après `keepDecisionPackCard` | Phase 5 · Boosters, `docs/groupe-2-boosters.md` |
| Révéler en touchant directement chacune des 5 cartes de la rangée ; la révélation passe aujourd’hui par le paquet, qui porte le flip et les reveals SR/SSR/LR figés | Phase 5 · Boosters |
| Trier le Marché par « Les plus populaires » ; nécessite une mesure de popularité (suivis, vues) exposée par `list_auctions` | Phase 6 · Marché, `docs/groupe-3-marche.md` |
| Rechercher une carte dans le Marché ; nécessite un paramètre de recherche côté `list_auctions` (ou un filtre client sur la liste déjà chargée, à valider) | Phase 6 · Marché, `docs/groupe-3-marche.md` |
| Proposer « Obtenir des Karas » à côté de l’alerte de solde insuffisant ; aucun moyen d’acquérir des Karas n’existe en dehors du jeu | Phase 6 · Marché, `docs/groupe-3-marche.md` |
| Suggérer un prix de départ recommandé dans la modale de vente ; nécessite une valeur de marché par carte | Phase 6 · Marché, `docs/groupe-3-marche.md` |
| Lancer des confettis ou un flash sur la ligne d’historique lors d’une nouvelle mise | Phase 6 · Marché, `docs/groupe-3-marche.md` |
| Afficher dans le détail d’une carte de la Collection si elle est verrouillée (en enchère) ; `CollectedCard` n’expose aucun état de verrouillage et `Game` ne transmet pas `presentation.frozen` à `CollectionView`. Le composant gère déjà cet état (boutons Mettre aux enchères / Détruire désactivés) dès qu’il est fourni ; en attendant, c’est le serveur qui refuse l’action | Correctif modale de détail, maquette Gemini |
| Afficher la valeur de marché dans le détail d’une carte de la Collection ; la ligne n’apparaît que si `presentation.marketValue` est fourni, ce que `Game` ne fait pas aujourd’hui | Correctif modale de détail, maquette Gemini |
