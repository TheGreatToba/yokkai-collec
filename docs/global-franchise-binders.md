# Classeurs globaux par franchise

La projection regroupe les saisons, films, remakes et sous-franchises confirmées sans remplacer les titres des cartes. La table explicite `global_binder_aliases` est la seule source de regroupement. Une similarité de nom, un personnage partagé, une adaptation d’un même texte du domaine public ou un crossover ne suffisent pas à créer une correspondance.

## État et déploiement

Cette livraison ne déploie rien en production. Les deux migrations sont **non appliquées sur le VPS** et installent la projection **désactivée par défaut** :

- `20261024200000_global_binder_projection.sql` : tables, vues, compatibilité des préférences et RPC.
- `20261024200001_global_binder_mapping.sql` : liste fermée des correspondances, checksum et état désactivé.

Une activation de production exige une autorisation explicite du propriétaire, la revue des extensions du manifeste, un instantané frais en lecture seule, la coordination prévue par `COLLABORATION.md` et une CI GitHub verte sur une branche à jour. Ne pas interpréter l’accord éditorial comme une autorisation de déploiement. Ne pas merger cette PR pour contourner ce point.

L’audit détaillé, les copies originales du ZIP, les comparaisons de catalogue et les décomptes dérivés de production sont conservés dans la livraison locale. Ils ne sont pas nécessaires au fonctionnement de l’application et ne font pas partie de cette PR. Les références du mapping versionné sont les noms de franchises et leurs métadonnées éditoriales publiques ; il ne contient aucun ID de joueur ou de carte, ni décompte de préférences réelles.

## Préservation

`cards`, `card_franchises`, `card_categories`, collections, dossiers, favoris de cartes, enchères et échanges ne sont pas réécrits par les migrations. Les vues `security_invoker` dédupliquent les couples carte/classeur ; les RPC conservent leurs contrôles d’authentification, d’amitié et de confidentialité. Les champs `anime` des cartes continuent à contenir le titre source. Les recherches de classeurs acceptent aussi les noms sources, puis calculent le total de tout le classeur trouvé.

Les favoris et widgets historiques restent stockés sous leurs noms sources. Après activation, un choix global est enregistré sur ses sources réelles ; retirer le favori global retire tous ses alias de façon atomique pour le joueur connecté. La sauvegarde d’un widget conserve les sources et leur appartenance au groupe, sans tronquer une franchise qui contient plus de douze titres. La limite de douze porte sur les choix de franchises. La confidentialité et les timestamps historiques restent inchangés jusqu’à une action explicite du joueur.

La nouvelle RPC de favoris est utilisée par le client. Le repli sur l’ancienne écriture ne se produit qu’en cas d’absence de cette RPC (`PGRST202`), pendant le déploiement en plusieurs étapes ; une erreur de permissions ou une autre panne ne déclenche aucun repli.

Lorsque la projection est active, des politiques RLS restrictives refusent explicitement les anciennes écritures directes de favoris avec `BINDER_REFRESH_REQUIRED` / `42501`. Un ancien onglet doit ainsi être rafraîchi avant toute mutation ; il ne peut pas retirer silencieusement une seule source d’un favori global. La RPC propriétaire conserve son contrôle par `auth.uid()` et écrit de façon atomique.

## Activation et retour arrière

`supabase/operations/enable-global-binders.sql` est une opération manuelle, distincte des migrations automatiques. Elle vérifie la checksum attendue, l’existence exacte des sources, les catégories, l’absence de chaînes et la conservation des licences secondaires, avant d’activer la projection dans une transaction. Une divergence provoque un rollback. Le trigger d’activation impose également les contrôles de correspondance et de checksum. L’empreinte utilise des champs UTF-8 encadrés par leur longueur et un ordre binaire stable, identiques dans Node et PostgreSQL.

`supabase/operations/disable-global-binders.sql` désactive l’affichage global dans une transaction, sans restaurer des données historiques par-dessus les nouveaux choix des joueurs. Les titres sources, préférences et correspondances restent conservés. La compatibilité des préférences reste active après une première activation : cela permet de réafficher toutes les sources d’un choix global et de le sauvegarder à nouveau après retour arrière. Une grande franchise peut donc réapparaître avec plus de douze noms sources dans un widget pendant ce retour à l’affichage historique ; aucune entrée n’est supprimée pour respecter artificiellement l’ancienne limite. Ce rollback fonctionnel n’est pas une désinstallation du schéma. Les anciennes définitions des RPC de lecture sont archivées, avec leurs permissions inchangées lors du remplacement.

Avant un déploiement futur, vérifier en plus la migration préalable `20261024160000_preserve_secondary_card_franchises.sql` sur le VPS. Une remise à null de la licence primaire ne doit pas effacer les licences secondaires. Les opérations de cette livraison ne modifient pas ce champ.

## Recette reproductible

Les tests ciblés `global-binder-mapping.test.mjs`, `global-binder-favorite-client.test.mjs` et `global-binder-projection-db.test.mjs` vérifient les refus de correspondance, le routage client, les invariants, les filtres, les préférences et le rollback. Les tests existants de pagination, profils, confidentialité et licences secondaires sont conservés. Le seul ajout à la liste des droits `SECURITY DEFINER` est `set_global_binder_favorite(text, boolean)` pour `authenticated`, sans identifiant de joueur en entrée ; il agit uniquement pour `auth.uid()`.

```sh
node scripts/build-global-binder-mapping.mjs --check
node scripts/rehearse-global-binders.mjs --snapshot /path/local-catalogue.json --report /path/local-report.json
```

La recette exige un moteur Docker local, crée un PostgreSQL 17 jetable sans réseau ni port exposé, rejoue le schéma précédent, charge les noms/identifiants/licences du catalogue local, applique les migrations et compare chaque classeur à un calcul indépendant par ensembles d’UUID. Les autres métadonnées de cartes sont des valeurs de recette et tous les joueurs sont synthétiques. Elle vérifie les lignes complètes avant/après installation et activation, les licences multiples, les préférences, les garde-fous, l’idempotence du seed et le retour arrière, puis supprime son propre conteneur. Elle n’utilise aucun secret, session ou enregistrement privé de joueur de production.

La CI complète reste exécutée par GitHub Actions. Aucun test existant n’est supprimé ou assoupli ; les déclencheurs de CI ne changent pas.

## Limite de validation visuelle

Aucun composant, style ou structure d’écran produit n’a été changé. La vérification navigateur locale a toutefois été interrompue par le contrôle computer-use, qui ne pouvait pas déterminer l’URL courante sous Windows avec une certitude suffisante. Les tailles **320, 375, 768, 1024 et 1440 px, ainsi que le zoom 200 %**, sont donc **non vérifiées**. L’aperçu temporaire local a été retiré. Ne pas déclarer la validation visuelle terminée ni la livraison prête à déployer sur la seule base des tests SQL.
