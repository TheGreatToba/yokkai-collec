# Revue complémentaire avant déploiement des classeurs globaux

La production n'a été ni modifiée ni activée par cette revue. La PR reste en brouillon. **Le contrôle visuel est bloqué : la livraison n'est pas prête pour un déploiement.**

## Résultats

| Demande                                                                 | Résultat                                                                        | Preuve et limite                                                                                                                                                      |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Revoir les 91 extensions                                                | PASS pour la revue ; aucune approbation de production                           | [91 décisions individuelles](global-binder-extension-review.json), identité et chemins publics relus ; 88 relations non identitaires et trois ancres sans redirection |
| Contrôler la migration des licences secondaires sur le VPS              | PASS                                                                            | Version `20261024160000` présente ; définition active corrigée, lue dans une transaction READ ONLY ; comportement reproduit en base isolée                            |
| Recette visuelle aux cinq largeurs et au zoom 200 %                     | BLOQUÉ / NON VÉRIFIÉ                                                            | URL locale explicite HTTP 200 ; computer-use s'arrête lors de la première action Chrome sur son contrôle d'URL                                                        |
| Classeurs, compteurs, progression, recherche, filtres, favoris, profils | PASS SQL ; NON VÉRIFIÉ visuellement                                             | Recette PostgreSQL et tests de projection ; la page locale monte les composants réels avec une fixture synthétique, sans prouver le résultat dans un navigateur       |
| Suite automatisée complète et CI                                        | [Checks PR #481](https://github.com/TheGreatToba/yokkai-collec/pull/481/checks) | Exécution complète dans GitHub Actions ; le rapport local final conserve les résultats et le SHA contrôlé                                                             |

## Revue éditoriale

La vérification croise l'identité exacte des médias, leurs titres anglais et romaji, leurs relations et les sources des éditeurs/studios. Les 111 fiches nécessaires aux chemins des 91 lignes ont été relues depuis l'API publique AniList. Aucun chemin ne suffit à lui seul à justifier une franchise commune. La liste n'est pas générée à partir de ressemblances de noms.

Les 52 œuvres Gundam sont revues sous la même franchise éditoriale : Universal Century, continuités alternatives, Build, parodies et courts métrages. Leurs cadres distincts restent dans les titres sources. Le catalogue Sunrise confirme également la marque Brave pour Fighbird et Goldran ; cela ne rattache pas les œuvres indépendantes contenant le mot Brave.

Les cas de frontière confirmés disposent d'un appui supplémentaire : [XENOGLOSSIA est issu d'IDOLM@STER selon Sunrise](https://www.sunrise-inc.co.jp/idolmaster/outline/), [Sasami est présenté comme dérivé de Tenchi par VAP](https://store.vap.co.jp/syousai.asp?item=VPCG-84833), [Pretty Sammy est un récit parallèle Tenchi](https://www.b-ch.com/titles/420/), [Liz appartient au projet Sound! Euphonium](https://liz-bluebird.com/), [Mysteria est une adaptation de la branche Manaria de Bahamut](https://www.kodansha.co.jp/titles/1000030047), et [Vanquished Queens figure dans le projet Queen's Blade](https://queensblade.net/goods/vanquished.html). Time Fighters correspond exactement au romaji Time Bokan des cartes et à la série Tatsunoko ; aucun rapprochement lexical n'est utilisé.

Aucune nouvelle ambiguïté d'appartenance n'a été retenue parmi ces 91 lignes. Cela ne vaut pas autorisation du propriétaire pour les introduire en production. Le seed, ses alias et sa checksum restent inchangés pendant cette revue. Les trois ancres `InuYasha`, `Shadowverse` et `Yu-Gi-Oh!` sont déjà égales à leur cible et ne créent pas de redirection.

## Exceptions séparées

Les 43 candidats non regroupés du rapport local restent en attente ou exclus. Les crossovers Fairy Tail/Seven Deadly Sins et Fate/Garden of sinners ne prouvent pas une franchise commune. Les frontières Muv-Luv/Rumbling Hearts, Junjo/Sekai Ichi, Megalobox/Joe et Tsubasa/xxxHOLiC restent non résolues. Les deux sources Madoka/Sonico suspendues dans le mapping initial restent séparées. Les exclusions Yobi, Shangri-la/Frontier, Plus-Sized et Higurashi/Umineko ne changent pas.

L'ancien écart Umamusume entre capture et catalogue demeure une question historique : aucun ancien instantané ne permet d'en certifier la cause. Les totaux actuels de recette ne sont pas réinterprétés comme ceux de l'époque.

## VPS et comportement des licences secondaires

Le constat du premier rapport est remplacé par le nouveau contrôle : migration enregistrée et fonction active sans suppression de `card_franchises`. L'état réel a été capturé dans une transaction `READ ONLY`, avec `default_transaction_read_only=on` et fin par `ROLLBACK`. Aucun compte, carte ou favori de test n'a été créé sur le VPS.

Les fonctions de normalisation et celles appelées par les triggers capturés ont ensuite été installées dans une base locale PGlite rejouant le schéma. Les définitions des triggers de `cards` correspondent à celles relevées sur le VPS. Neuf scénarios couvrent `NULL`, chaîne vide et espaces dans `ANIME/MANGA`, `ARTIST` et `FILM`. Chaque carte possède une source primaire initiale et deux liens secondaires ; l'ensemble des lignes de liens reste identique après effacement du primaire puis modification d'un autre champ. La correction déjà versionnée et ses tests existants sont conservés ; aucune migration corrective supplémentaire n'est nécessaire pour la définition observée.

Cette méthode vérifie le code actif sans faire de mutation de test en production. Elle ne remplace pas une nouvelle vérification avant une activation ultérieure.

## Recette visuelle à terminer

La page `/design-system/global-binder-review` utilise `CollectionView` et `ProfileExperience`. Ses données sont synthétiques ; elle ne reproduit pas l'authentification réseau et ne remplace pas les tests SQL. Elle expose les classeurs personnels, un profil ami et un profil privé. Aucun compte de production n'est utilisé.

Lancer le serveur avec une configuration explicitement locale :

```powershell
$env:NEXT_PUBLIC_SITE_URL = 'http://127.0.0.1:3027'
$env:NEXT_PUBLIC_SUPABASE_URL = 'http://127.0.0.1:3031'
$env:NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_local_review_fixture'
$env:SUPABASE_URL = 'http://127.0.0.1:3031'
$env:SUPABASE_SERVICE_ROLE_KEY = ''
$env:MAINTENANCE_MODE = 'false'
npm.cmd run dev -- --webpack --hostname 127.0.0.1 --port 3027
```

Ouvrir `http://127.0.0.1:3027/design-system/global-binder-review?surface=collection`. Sélectionner Binder. À chacune des largeurs 320, 375, 768, 1024 et 1440 px, puis au zoom navigateur 200 % :

1. Vérifier le wrapping des longs titres, l'absence de débordement de page, les commandes tactiles et le clavier.
2. Vérifier Sonic **10 / 26**, IDOLM@STER **5 / 12**, Pokémon **6 / 18**. La copie Shiny supplémentaire de Sonic ne doit pas augmenter la progression.
3. Rechercher `Heroes` : seul le classeur Sonic est trouvé ; ouvrir ce classeur affiche les 26 cartes, pas uniquement les sept cartes Heroes.
4. Vérifier recherche de cartes, catégorie, rareté, cartes possédées seulement, pagination et retour à la liste.
5. Ajouter/retirer un favori, activer le filtre Favorites, vérifier `aria-pressed` et le profil après navigation interne.
6. Dans Friend profile, vérifier les favoris globaux et ouvrir la collection en modale. Dans Private profile, vérifier l'absence de collection et de compteurs privés.

Ces actions n'ont pas été exécutées après l'arrêt imposé de computer-use ; aucune capture de recette n'est présentée comme réussie. Les profils et filtres ont des preuves SQL séparées, sans validation de leur disposition à l'écran.

## Conditions restantes

Terminer la recette visuelle, obtenir la revue/autorisation explicite du propriétaire sur les extensions et l'activation, puis relire le catalogue et l'état des migrations juste avant une éventuelle opération. Les deux migrations `20261024200000_global_binder_projection.sql` et `20261024200001_global_binder_mapping.sql` restent non appliquées sur le VPS ; aucune activation n'est autorisée par ce document.
