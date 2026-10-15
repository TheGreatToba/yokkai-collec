# Contrat de tests : fusion SSR vers UR

Changement produit confirmé par l'utilisateur le 15 octobre 2026, avec validation
de Walid et coordination avec sa PR #247 confirmées dans la conversation.

- Cinq exemplaires SSR identiques non-shiny donnent désormais une UR non-shiny.
- UR est entre SSR et LR ; aucune conversion des shiny déjà obtenues.
- Les probabilités des boosters ne changent pas.

Cette PR ne modifie que le contrat du test d'interface. Les assertions historiques
restent actives tant que la nouvelle migration n'existe pas. Dès que la migration
`20261015000008_ssr_evolution_ur.sql` est livrée, le même test exige exclusivement
le nouveau contrat UR et interdit les anciens libellés Shiny. Il ne peut pas
accepter indifféremment les deux comportements.

Les tests SQL historiques rejouant explicitement les anciennes migrations
conservent leurs assertions SSR shiny : ils protègent l'historique, pas la règle
après la migration UR. De nouveaux tests SQL couvriront celle-ci dans la PR de
mécanique, sans modifier ces assertions historiques.

Migration dans cette PR : aucune. Application sur le VPS : aucune.
