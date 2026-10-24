# Nettoyage des références héritées après migration VPS

Correction exécutée le **23 octobre 2026**, après validation du plan par
l'utilisateur, sur la production **62.83.37.242**. Les heures sont en Europe/Paris.
L'ancien VPS n'a pas été contacté. Aucune opération Cloudflare/DNS, migration
Supabase, modification de schéma ou mise à jour d'image n'a été effectuée.

## Résultat

Les quatre variables orphelines Kong ont été retirées de leur source persistante
Coolify, du `.env` opérationnel et de l'environnement des quatorze conteneurs
Supabase concernés. Le générateur de `.env` n'a plus de référence Kong à exporter.
Les domaines publics et endpoints Docker corrects ont été conservés.

| Élément                          | Correction                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Coolify `environment_variables`  | Retrait des quatre lignes 552–555, exclusivement pour le service nº 6              |
| Variables                        | `SERVICE_FQDN_SUPABASEKONG`, `SERVICE_URL_SUPABASEKONG` et leurs variantes `_8000` |
| `.env` de la stack Supabase      | Retrait de ces quatre définitions uniquement                                       |
| Nouveau manifeste opérationnel   | `/opt/yokkai-ops/runtime/compose-production.json`, sans les 56 clés héritées       |
| Environnement Docker             | Quatorze conteneurs recréés avec les mêmes images, volumes et réseaux              |
| Métadonnée Coolify `public_ipv6` | Ancienne valeur non assignée au nouveau VPS neutralisée à `null`                   |
| Consigne opérationnelle          | Adresse de production et chemin du manifeste corrigés dans `docs/COLLABORATION.md` |

Kong ne figure plus dans le template actuellement enregistré. Le Compose brut,
le Compose généré Coolify et leurs labels n'utilisaient déjà plus les quatre
variables. Aucun remplacement vers un nouveau nom `sslip.io` n'a été effectué.

## Maintenance et contrôles

| Étape                          | Résultat                                                                                                                         |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Début de maintenance           | 18 h 48 min 11 s                                                                                                                 |
| Contrôle public                | HTTP 503 sur le domaine canonique et l'API, origine 62.83.37.242                                                                 |
| Gel effectif                   | 18 h 49 min 30 s : writers arrêtés, Coolify suspendu, tâches système suspendues, pg_cron off, lecture seule on, HBA TCP en rejet |
| Vérification du gel            | Aucune autre session cliente, aucun cron actif, compteurs d'écriture stables                                                     |
| Sauvegardes                    | Coolify, `postgres` et `_supabase` sauvegardés ; dumps métier contrôlés avec `pg_restore --list` et SHA-256                      |
| Après recréation PostgreSQL    | 18 h 51 min 57 s : 101 comptages et 56 empreintes concordants, aucune différence                                                 |
| Recréation des services        | 18 h 53 min 29 s : mêmes images/volumes, healthchecks sains, aucun environnement hérité                                          |
| Tests publics sous maintenance | 18 h 54 min 18 s : contrôles fonctionnels réussis et preuves d'origine dans les logs du nouveau proxy                            |
| Avant réouverture              | Nouvelle comparaison des 56 empreintes métier/Storage : toujours identiques                                                      |
| Réouverture                    | **18 h 55 min 51 s**, maintenance retirée, cron, Horizon, scheduler et timer réactivés                                           |

Durée de maintenance : **environ 7 min 40 s**.

Le premier contrôle opérateur Auth avait omis la clé publique API et obtenu 401. La requête de contrôle a été corrigée avant l'arrêt des services ; aucun
changement de droits ou de configuration d'authentification n'a été nécessaire.

## Données préservées

| Donnée              | Avant intervention, après recréation et à la fin des tests |
| ------------------- | ---------------------------------------------------------: |
| Utilisateurs Auth   |                                                         63 |
| Profils             |                                                         63 |
| Cartes catalogue    |                                                     91 904 |
| Cartes possédées    |                                                     22 853 |
| Métadonnées Storage |                                                    158 137 |

Les **101 comptages** ont été comparés après recréation de PostgreSQL, avant
le démarrage des autres services. Les **56 empreintes de contenu public/Storage**
ont été comparées à cette étape puis encore après les tests, avant réouverture.
Aucun écart n'a été trouvé. Les nouvelles écritures de production après
réouverture peuvent naturellement faire évoluer ces chiffres.

| Dump de précaution      |      Octets | SHA-256                                                            |
| ----------------------- | ----------: | ------------------------------------------------------------------ |
| `postgres-before.dump`  |  40 482 370 | `dec71fd921e8f461efdcf616a7a21926491250688c192ef30a0367c94a8151ad` |
| `_supabase-before.dump` | 208 017 169 | `f41e9638e32b51054737b8793e0ba8dc46a4a8d304755db2f27c9d5e88b3d2a3` |

Les sauvegardes et preuves de cette intervention sont protégées sous
`/opt/yokkai-ops/runtime/origin-cleanup-20261023/`. Elles comprennent les
anciennes métadonnées chiffrées, la copie du `.env`, le manifeste antérieur,
les dumps, les empreintes et les résultats de contrôle. Aucun secret n'est
ajouté au dépôt.

## Validation fonctionnelle et surveillance

- Auth health et lecture d'un utilisateur authentifié : HTTP 200.
- Profil par RPC de lecture, collection et cartes : HTTP 200.
- Homepage, Profile, Collection, Catalog, Packs et Market : HTTP 200 sous
  exception opérateur, pendant que le public reste en maintenance.
- Six images Storage : HTTP 200, type image et taille conformes aux métadonnées.
- Buckets Storage accessibles ; backend S3 toujours `http://supabase-rustfs:9000`.
- Realtime : connexion WSS authentifiée et souscription acceptée.
- Requêtes de contrôle canonique/API retrouvées dans les journaux du nouveau
  proxy. Aucun envoi d'email, paiement, création de compte ou objet de test.
- Après réouverture : domaine canonique et health Auth publics en 200, sans
  en-tête de maintenance.

Au relevé de **18 h 56 min 59 s**, les vingt services sont actifs, les dix-huit
healthchecks présents sont sains et aucun conteneur n'est suspendu. Les quatorze
conteneurs recréés sont une nouvelle génération : leurs compteurs de redémarrage
repartent à zéro. Tous les conteneurs actifs affichent alors zéro redémarrage
automatique. Les deux anciens conteneurs de diagnostic arrêtés restent conservés.

Aucun nouveau HTTP 500/502/503/504 n'est observé depuis la réouverture dans ce
relevé. Les logs Docker inspectés ne contiennent pas de nouveau mot-clé
ERROR/FATAL/PANIC/CRITICAL dans cette fenêtre bornée. Le réglage PostgreSQL
`log_min_messages=fatal` et les avertissements RustFS précédemment identifiés
restent hors du périmètre de cette correction ; leur suivi demeure nécessaire.

Horizon et `schedule:work` sont présents, cron système et timer de maintenance
sont actifs ; un premier job pg_cron après réouverture a réussi, sans échec.
Environ 11,6 Gio de RAM disponibles, 193 Gio de disque libres et load
2,46 / 2,59 / 2,57 pour huit vCPU : pas de saturation observée.

## Sources opérationnelles et références historiques

À utiliser pour l'exploitation contrôlée :

- domaine API public `https://api.yokkai-collec.com` ;
- `SERVICE_URL_SUPABASEENVOY` et `SERVICE_FQDN_SUPABASEENVOY` correspondants ;
- API interne `http://supabase-envoy:8000` ;
- PostgreSQL interne `supabase-db:5432` ;
- manifeste de reprise `/opt/yokkai-ops/runtime/compose-production.json`.

Ce manifeste décrit les conteneurs au moment du nettoyage. Après un futur
déploiement applicatif, vérifier sa concordance avec la production avant toute
utilisation ciblée. Le déploiement normal de l'application reste géré par
Coolify ; une reprise globale depuis un manifeste figé ne doit pas remplacer
un déploiement applicatif plus récent.

Les anciennes lignes Coolify et les valeurs exportables ont été inspectées en
mémoire après réouverture : aucune référence à l'ancienne IP ou à Kong ne
subsiste dans cette source d'export. Même résultat pour les configurations des
vingt conteneurs actifs et leurs connexions réseau au relevé.

Sont conservés sans modification : manifestes dans le dossier de migration,
fichiers `.before-*`/`.bak-*`, dumps et preuves historiques, certificats ACME,
anciens résultats DNS Coolify et migration SQL de remplacement d'origine.
Les empreintes des fichiers historiques contrôlés correspondent à celles
enregistrées avant intervention. Aucun conteneur, volume ou fichier de données
n'a été supprimé sur l'ancien VPS ; aucune commande n'y a été exécutée.

La métadonnée IPv6 a été neutralisée uniquement dans Coolify. Aucun AAAA, route,
interface, pare-feu ou paramètre TLS n'a été changé. Les nouvelles données de
production restent sur le nouveau VPS : aucun rollback DNS aveugle n'est permis.
