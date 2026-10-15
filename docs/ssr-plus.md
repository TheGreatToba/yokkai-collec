# SSR+ : finition améliorée des SSR

SSR+ remplace le projet UR, qui n’a jamais été fusionné ni déployé en production.
La rareté de base reste SSR. Le cadre et les badges restent roses ; le badge de
finition affiche `+` à la place de l’étoile Shiny. Reflets, scintillements et
animation holographique restent actifs. Les LR Shiny sont inchangées.

Le stockage existant (`rarity = SSR`, `is_shiny = true`) représente SSR+.
Les anciennes SSR Shiny adoptent donc ce rendu sans suppression ni duplication.
La fusion existante de cinq SSR identiques non Shiny reste inchangée, avec
`is_evolved = true`. Les SSR+ restent distinctes des SSR normales dans les
regroupements ; les taux de drop et les récompenses ne changent pas.

## Validation et migrations

- Contrat produit et tests validés avec Walid dans la PR de tests séparée.
- Aucun nouvel enum, aucune nouvelle migration Supabase, aucune intervention VPS.
- La base Docker locale avait reçu le prototype UR de la branche abandonnée :
  restaurer localement la fonction `evolve_ssr_card` depuis la migration historique
  `20261003000002_evolve_ssr_five_copies.sql`. Convertir seulement les éventuelles
  copies UR de test en SSR améliorées ; ne pas supprimer de cartes.
- Ne pas réécrire l’historique local des migrations ni tenter de supprimer la
  valeur enum UR par reconstruction des tables. Cette valeur locale inutilisée
  ne doit pas être propagée en production.
- Les anciennes PR UR sont remplacées par les PR SSR+.

## Aperçu

`/design-system/ssr-plus-preview` montre SSR, SSR+ et LR Shiny côte à côte,
puis six copies simulées pour tester la fusion sans requête Supabase.
