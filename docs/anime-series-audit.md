# Audit Anime/Manga par série identifiable

Cette branche remplace la politique de la PR #481 : **une série identifiable par classeur**, avec regroupement des saisons et parties directes. Tokyo Ghoul et Tokyo Ghoul:re ont deux identités distinctes. Le mapping de franchise précédent reste une comparaison historique, sans cohabitation des moteurs de projection.

## Portée de cette livraison

Cette livraison réalise l'audit, produit une proposition A/B/C/D et fournit une **recette locale** de projection par carte. Elle ne modifie aucun écran ni aucune RPC produit, ne s'intègre pas encore au pipeline d'import, n'installe aucune migration en production et ne réinitialise aucun favori. La validation éditoriale précède l'intégration applicative. Les fichiers SQL sous `supabase/recipes/` ne sont pas des migrations automatiques.

Les exports de catalogue et les rapports détaillés restent locaux, hors Git : identifiants de cartes et agrégats de production ne sont pas publiés dans cette PR. Les tests versionnés utilisent uniquement des fixtures synthétiques.

## Provenance

`cards.source_id` est un identifiant de personnage dans l'import AniList, pas un identifiant de média. Le script `data/clean_and_assign_rarity.py` écrit l'espace source `anilist` et le personnage dans `data/characters_clean.csv`. `data/anilist_par_anime.py` conserve un personnage dans `etat_scraping.json` avec le média le plus populaire associé au moment de l'import. Cet artefact permet de retrouver un média candidat par titre exact ; il ne reconstitue pas toutes les apparitions du personnage.

Une carte est corroborée lorsque l'espace source, le CSV original, l'identifiant et l'identité du personnage dans l'artefact concordent. Un nom modifié ou une preuve manquante protège la carte au lieu de forcer sa réassociation. `source=manual` est toujours exclu. La catégorie Anime/Manga, un numéro ou un titre trouvé sur AniList ne prouvent rien seuls. Une concordance de titre sert à résoudre le média dans les preuves d'import, après établissement de la provenance ; l'identité du média est ensuite recoupée avec la réponse API actuelle.

La règle ne couvre que le lien primaire prouvé : une licence secondaire n'hérite jamais du média primaire. Une divergence du romaji, de la licence primaire par rapport aux transformations historiques connues ou des titres API protège aussi cette association. Les altérations historiques ne sont pas réparées automatiquement.

## Décisions

`anime-series-decisions.mjs` distingue les relations et la série :

- A : même média avec plusieurs libellés, ou relation directe de saison/partie vérifiée et même identité de série ; proposition soumise à revue, pas une approbation de production.
- B : film, spécial, remake, frontière d'adaptation ou fragment de saisons dont la série racine reste à établir.
- C : série distincte ou absence de regroupement A établi ; conserver le rangement source.
- D : origine manuelle/inconnue, association non prouvée ou autre catégorie.

Les quatre règles Tokyo Ghoul fournies par le propriétaire sont explicites, indépendamment de la traversée du graphe. Aucun SEQUEL, SPIN_OFF, ALTERNATIVE ou préfixe ne suffit à lui seul. Les règles A ne passent jamais automatiquement par une relation B/C/D. Un composant de saisons déjà enregistré sous un seul libellé n'est pas réaffecté : cela évite de recréer une fragmentation à partir d'un sous-ensemble.

Les identifiants de classeurs sont stables pour le manifeste versionné et distincts du texte affiché. Une modification de titre ne change pas l'identité. Lors d'une révision future, conserver les identifiants existants ; ne pas recalculer une identité publiée à partir d'une nouvelle racine chronologique.

## Projection de recette et limites avant intégration

La recette SQL stocke des classeurs stables, des règles de média, des preuves d'origine par carte et une affectation par lien source exact. Les preuves comportent l'instantané complet de la carte : une modification locale ultérieure rend l'affectation inopérante jusqu'à nouvelle revue. La vue conserve la carte et le lien d'origine dans tous les cas.

Une carte manuelle partageant `Tokyo Ghoul √A` avec une carte AniList reste dans son groupe source. Les groupes utilisent une clé stable distincte du libellé : un classeur manuel et un classeur AniList peuvent avoir le même titre sans être fusionnés. L'interface devra les distinguer par une indication d'origine accessible, sans renommer les titres sources. Aucun client actuel ne doit être branché sur la nouvelle vue en utilisant uniquement son `display_name` comme clé.

La recette refuse l'installation si l'ancien moteur `global_binder_settings` existe. Aucun seed approuvé ni script d'activation de production n'est fourni. Une simulation locale peut approuver les seuls candidats A dans le conteneur jetable ; le manifeste livré reste non approuvé. Le rollback désactive la présentation sans restaurer une ancienne copie des données joueurs.

L'intégration future devra adapter ensemble les RPC de classeurs personnels/amis, les profils, les filtres, les favoris et le client pour transporter les clés stables. Les droits d'accès existants restent obligatoires. Les favoris historiques sont indexés par nom : lorsqu'un nom désigne plusieurs groupes protégés, conserver la préférence brute et demander une résolution plutôt que l'attribuer silencieusement. Aucun nettoyage de favoris n'est nécessaire à l'audit. Toute éventuelle remise à zéro demanderait une opération séparée, une sauvegarde privée et une autorisation explicite.

Le nouvel import devra écrire un registre de provenance vérifiable avec personnage, média et lot d'import, puis consulter uniquement les règles de médias approuvées. `planFutureMedia` démontre le comportement attendu : un média connu et approuvé retrouve son identifiant stable ; une nouvelle saison inconnue est mise en revue et les origines protégées sont exclues. Ce helper n'est pas encore raccordé au script d'import. Le normaliseur historique des titres devra être revu séparément avant cette intégration ; aucun changement global de normalisation ne doit affecter les imports manuels ou les autres catégories.

## AniList et cache

Les [conditions officielles](https://docs.anilist.co/guide/terms-of-use) et les [limites de débit](https://docs.anilist.co/guide/rate-limiting) ont été consultées. Le propriétaire a confirmé un usage commercial inférieur à 150 USD/mois. L'outil exige cette confirmation avant une requête, ainsi qu'un objectif d'audit précis et une liste explicite de médias issue du catalogue local. Il n'énumère pas le catalogue AniList et ne suit pas récursivement les relations.

Le client déduplique les ID, limite les lots à 50, espace les requêtes de 2,5 secondes, respecte 429/Retry-After/RateLimit-Reset, borne les reprises et sauvegarde après chaque lot. Le cache exclut les données hors périmètre et expire au bout de sept jours. Il est réservé à l'audit et ne doit pas devenir un miroir ou une base de secours AniList. Les scripts historiques de collecte massive ne sont pas exécutés par cette livraison.

## Reproduction et tests

Les chemins de snapshots et résultats restent hors Git. Exemple après préparation de preuves d'import et contrôle des conditions API :

```powershell
node scripts/fetch-anime-audit-media.mjs --scope /local/scope.json --output /local/media-cache.json --commercial-under-150-confirmed
node scripts/audit-anime-series.mjs --snapshot /local/catalogue.json --import-csv data/characters_clean.csv --import-state data/etat_scraping.json --media-cache /local/media-cache.json --normalized-titles /local/normalized-titles.json --previous-mapping /local/previous-mapping.json --output /local/audit
node scripts/rehearse-anime-series.mjs --snapshot /local/catalogue.json --mapping /local/audit/mapping_anime_manga.json --report /local/audit/staging-postgres.json
node --test tests/anime-series-audit.test.mjs
```

La recette PostgreSQL 17 impose un Docker local, sans réseau ni port publié. Elle charge exactement les lignes du catalogue Anime/Manga dans le conteneur jetable, ajoute des joueurs entièrement synthétiques et des cartes témoins des autres catégories, compare les empreintes complètes avant/après, puis supprime son propre conteneur. Les collections réelles ne sont pas clonées.

Les tests couvrent Tokyo Ghoul, une source partagée entre manuel et AniList, les origines inconnues, les liens secondaires, un média absent, la décision sur une suite majeure, les saisons futures, les règles non approuvées, l'invalidation des preuves après modification, les droits et le rollback. La suite complète est exécutée dans GitHub Actions ; aucun test existant n'est affaibli.

La validation visuelle reste **bloquée et non vérifiée** : computer-use Windows a interrompu sa première action Chrome faute de pouvoir déterminer l'URL avec certitude, malgré une configuration locale explicite lors du précédent essai. Aucun nouveau mécanisme d'interface n'a contourné cet arrêt. Cette branche n'intègre pas encore les nouvelles clés aux écrans ; elle ne prétend donc pas avoir validé les profils, favoris, recherche ou progression du nouveau modèle dans le navigateur.
