# Fusion SSR → UR

Contrat confirmé le 15 octobre 2026 : cinq SSR identiques non-shiny deviennent
une UR non-shiny, classée entre SSR et LR. Les anciennes SSR shiny restent
inchangées. Aucun taux de drop ni récompense de succès n'est modifié.

## Modèle

- La rareté UR appartient à `user_cards.rarity`, pas à `cards.rarete_base`.
  Le catalogue et la complétion gardent donc une seule entrée pour la carte.
- La fusion consomme précisément les cinq identifiants sélectionnés et crée un
  nouvel exemplaire avec l'illustration du catalogue, sans dossier ni image
  personnalisée. Les exemplaires non sélectionnés restent intacts.
- Verrous de lignes dans un ordre déterministe, propriété, rareté, identité,
  caractère non-shiny, verrouillage et enchères sont vérifiés côté SQL.
- Les profils, partages, échanges, enchères et archives de suppression conservent
  la rareté UR de l'exemplaire. Les variantes SSR et UR ont des liens de partage
  distincts. Les archives déjà enregistrées ne sont pas réécrites.
- Le filtre UR du classeur montre les UR possédées dans la licence, sans créer
  de nouvelles cases UR à découvrir dans le catalogue. La vue non filtrée reste
  le catalogue de base ; les contrôles de confidentialité sont inchangés.
- La destruction UR reprend les 4 Karas d'une SSR : pas de rééquilibrage
  économique implicite. LR reste à 5 Karas.

## Livraison et compatibilité

PR de contrat de tests : #253, séparée de la mécanique et validée dans la
conversation. Aucun test historique SQL n'est modifié pour effacer la règle
Shiny des anciennes migrations.

Deux migrations nouvelles, **non appliquées sur le VPS** à ce stade :

1. `20261015000007_add_ur_rarity.sql` : ajoute l'enum UR et termine sa transaction.
2. `20261015000008_ssr_evolution_ur.sql` : règles, fusion et modèles de lecture,
   dans une transaction distincte. PostgreSQL interdit d'utiliser une valeur
   d'enum nouvellement ajoutée avant son commit.

Coordonner avec Walid avant toute application en production et utiliser le
script officiel avec sauvegarde et contrôle de dérive. Pour une livraison
progressive, déployer le client compatible avant la deuxième migration : son
contrôle `get_game_info().rarities` refuse la fusion tant que le serveur annonce
encore la règle historique. Le cache d'information peut retarder l'activation
de 60 secondes ; il ne peut pas consommer des SSR selon l'ancienne règle.

Ne pas revenir aveuglément aux anciennes contraintes après création d'UR :
elles refuseraient ces nouvelles cartes. Un retour arrière doit conserver le
modèle UR lisible et désactiver seulement les nouvelles fusions, sans supprimer
ni convertir les cartes des joueurs.

## Validation

Tests unitaires ciblés et PostgreSQL jetable : transaction, anciennes shiny,
sélections invalides, verrous, enchères, confidentialité, rechargement client,
tri et partage. Test de concurrence ajouté au service PostgreSQL 17 de la CI.
`scripts/browser-proof-ur-evolution.mjs` vérifie l'aperçu local sur ordinateur
et mobile, en bloquant les requêtes externes ; aucune RPC réelle n'est appelée.

Aperçu : `/design-system/ur-evolution-preview` (indisponible en production).
