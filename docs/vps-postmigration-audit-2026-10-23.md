# Audit post-migration — 23 octobre 2026

**Conclusion : À SURVEILLER.** La production sur `62.83.37.242` fonctionne et
les écritures utilisateur continuent. Aucun incident bloquant n'est observé.
Les points à suivre concernent les scans internes RustFS, des références Coolify
héritées de l'ancienne origine et la visibilité limitée des erreurs PostgreSQL.

Audit effectué entre **18 h 01 et 18 h 11, heure de Paris**, sans stress test,
sans modification de configuration ou de donnée métier et sans suppression.
Aucune commande n'a été exécutée sur l'ancien VPS pendant cet audit. Les seules
requêtes fonctionnelles sont des lectures HTTP et une souscription WebSocket
temporaire, sans broadcast, présence ou écriture métier.

## Référence et méthode

Comparaison avec les relevés protégés du serveur :

- `cutover/destination-postcutover-state.json`, du 23 octobre à 17 h 46 ;
- `cutover/final-stability-check.json`, du 23 octobre à 17 h 57 ;
- le [rapport de bascule dans la PR #457](https://github.com/TheGreatToba/yokkai-collec/pull/457).

Les relevés JSON de cet audit sont conservés localement hors Git dans le dossier
protégé de la mission, sous les noms `postmigration-audit-*.json`. Aucun secret,
export de configuration brut ou donnée utilisateur individuelle n'est ajouté au
dépôt. Les lectures SQL utilisent des transactions en lecture seule et un délai
maximal d'exécution. Aucun compteur n'a été réinitialisé.

## HTTP, application et Supabase

À 18 h 11, aucun HTTP **500/502/503/504** n'est observé pendant les quinze
dernières minutes dans le journal d'accès Traefik.

Depuis la réouverture de 17 h 40, le journal contient seulement les deux réponses
5xx déjà consignées dans le rapport de bascule :

- 17 h 41 min 37 s : 500 Auth sur la création du compte temporaire dont le
  premier jeu de test omettait le champ `pseudo` requis ;
- 17 h 43 min 09 s : 503 de la route catchall pour une requête à l'IP littérale,
  sans domaine applicatif configuré.

Aucun nouveau 5xx applicatif n'est trouvé après ces événements. Les logs de
Yokkai, Traefik, PostgREST et Storage ne présentent pas de nouvelle erreur dans
la fenêtre inspectée. L'erreur Auth retrouvée correspond au test déjà documenté.

| Lecture fonctionnelle              | Résultat                                                 |
| ---------------------------------- | -------------------------------------------------------- |
| Homepage publique                  | HTTP 200, 290 ms                                         |
| Supabase Auth `/health`            | HTTP 200, 180 ms                                         |
| Catalogue via PostgREST, une ligne | HTTP 200, 90 ms                                          |
| Quatre images Storage publiques    | HTTP 200, image/jpeg ; tailles conformes aux métadonnées |
| Latence des images                 | 107 à 173 ms ; 17 570 à 30 073 octets                    |
| Realtime public                    | Upgrade WebSocket 101 et souscription acceptée           |

Les lectures Storage traversent l'API et le stockage RustFS. Aucune création de
compte, connexion par mot de passe, modification de profil ou écriture Storage
n'a été rejouée pour cet audit. Ces tests avec écriture avaient été validés lors
de la bascule. Auth est ici vérifié par son healthcheck, ses logs et son état.

## PostgreSQL et continuité des écritures

PostgreSQL 17.6 est sain, hors récupération, en lecture/écriture, avec pg_cron
activé. Le processus a démarré à 17 h 39 min 46 s : aucun redémarrage depuis la
réouverture.

Environ **50 sessions clientes pour `max_connections=100`**, contre 58 au relevé
de référence. Les connexions correspondent aux services locaux Supabase. Aucun
client de l'ancienne IP n'est trouvé. Pas de requête cliente active depuis plus
de cinq secondes, de transaction laissée ouverte au repos, de session bloquée
ou de deadlock au relevé. Les deux slots logiques Realtime sont actifs ; le WAL
retenu est d'environ 1,1 ko par slot, sans accumulation préoccupante.

| Donnée              | Avant ouverture | Relevé de 17 h 46 | Audit vers 18 h 04 |
| ------------------- | --------------: | ----------------: | -----------------: |
| Utilisateurs Auth   |              63 |                63 |                 63 |
| Profils             |              63 |                63 |                 63 |
| Cartes catalogue    |          91 810 |            91 810 |             91 821 |
| Cartes possédées    |          22 770 |            22 780 |             22 800 |
| Métadonnées Storage |         158 000 |           158 000 |            158 011 |

La lecture directe de la base du nouveau VPS à 18 h 08 confirme **30 cartes
possédées datées après la réouverture**, ainsi que **16 cartes catalogue et 16
objets Storage** créés après celle-ci. La dernière obtention observée date de
18 h 03 min 03 s ; le dernier ajout catalogue/Storage, de 18 h 08 min 48 s.
Ces observations vérifient les écritures réelles sans générer de donnée de test.

Les compteurs de transactions continuent d'avancer et aucun nouveau deadlock
n'apparaît. Les volumes de fichiers temporaires restent stables pendant la
comparaison courte : environ 456 Mo sur `postgres` et 125 Mo sur `_supabase`.
Ces compteurs sont cumulatifs et incluent la restauration et les contrôles.

Deux lectures catalogue méritent un suivi de performance, sans saturation
constatée : la liste `cards` avec franchises, environ **941 ms en moyenne,
1 210 ms au maximum**, et le RPC `get_catalogue_cards_page`, environ **653 ms en
moyenne, 1 107 ms au maximum**. Il n'existe pas de relevé comparable avant
migration permettant de qualifier une régression. Les longues opérations COPY
visibles dans les statistiques correspondent aux opérations de migration et ne
sont pas des requêtes actuellement actives.

**Limite de visibilité :** le réglage actuel `log_min_messages=fatal` masque les
messages serveur de niveau ERROR ordinaires. La sortie PostgreSQL ne présente
pas de FATAL/PANIC récent, mais elle ne permet pas de certifier l'absence de
toute erreur SQL. `logging_collector=off`, destination stderr. Prévoir une revue
du niveau de journalisation et de sa rétention ; aucun réglage n'a été changé.
Une lecture diagnostique a utilisé initialement un nom de colonne inexistant ;
elle a été corrigée après inspection du catalogue système, sans écriture métier.
Les rollbacks de transactions de lecture de l'audit ne doivent pas être assimilés
à des échecs utilisateur.

## RustFS : avertissements à suivre

RustFS 1.0.0 est healthy, sans redémarrage supplémentaire. Sa consommation
ponctuelle est d'environ **102 % d'un cœur**, déjà proche d'un cœur dans le
relevé post-bascule. La lecture de ses fichiers internes `/logs` apporte des
informations que sa sortie Docker seule ne montrait pas :

- scans de capacité expirés à 17 h 43 et 18 h 03, après environ 15 s et 9,6 s ;
- à 18 h 04, scanner arrivé à son budget de 1 800 s puis cycle expiré ; le log
  indique curseur persistant, génération protégée et `recovery_required=false` ;
- au démarrage, cache de descripteurs désactivé car la limite souple est trop
  basse pour le cache prévu ; le service utilise l'ouverture à chaque lecture ;
- deux avertissements de lecture de volume introuvable au démarrage à 17 h 33,
  sans répétition récente dans les fichiers consultés ; aucune preuve de perte
  de données ne découle de ces seuls avertissements ;
- avertissement de parité nulle pour une configuration à un seul disque, et
  avertissements de configuration Pyroscope/KMS. Aucune variable KMS n'est
  configurée dans le conteneur ; aucun usage SSE-KMS n'a été testé par cet audit.

Les onze événements inspectés sont de niveau WARN, sans événement ERROR/FATAL.
Les mots `error` présents comme champs de certains WARN ne sont pas comptés
comme des événements de sévérité ERROR. Les images sont lisibles et aucun
problème d'intégrité n'est démontré. Le précédent relevé ne contenait pas cet
inventaire de fichiers : on ne peut pas dater ces constats comme une nouvelle
régression. Surveiller l'aboutissement des prochains cycles et examiner les
limites de descripteurs et le budget de scan avant toute modification.

## Inventaire Docker et redémarrages

**22 conteneurs conservés : 20 actifs, dont 18 healthy et deux sans healthcheck
Docker** (Yokkai et PostgREST, vérifiés fonctionnellement). Aucun service actif
unhealthy ou restarting. Les compteurs sont identiques aux relevés post-bascule.

| Conteneur                                        | État                                                         | Redémarrages |
| ------------------------------------------------ | ------------------------------------------------------------ | -----------: |
| coolify                                          | running / healthy                                            |            0 |
| supabase-db-gawq4yyxiise96wens0dt1ex             | running / healthy                                            |            0 |
| lbugcql3gc8ijtbv7qqy70do-20261023T104356         | running / sans healthcheck                                   |            0 |
| coolify-db                                       | running / healthy                                            |            0 |
| coolify-redis                                    | running / healthy                                            |            0 |
| coolify-proxy                                    | running / healthy                                            |            0 |
| realtime-dev-gawq4yyxiise96wens0dt1ex            | running / healthy                                            |            4 |
| supabase-storage-gawq4yyxiise96wens0dt1ex        | running / healthy                                            |            0 |
| supabase-rustfs-gawq4yyxiise96wens0dt1ex         | running / healthy                                            |            0 |
| supabase-analytics-gawq4yyxiise96wens0dt1ex      | running / healthy                                            |            0 |
| supabase-vector-gawq4yyxiise96wens0dt1ex         | running / healthy                                            |            0 |
| supabase-meta-gawq4yyxiise96wens0dt1ex           | running / healthy                                            |            0 |
| supabase-studio-gawq4yyxiise96wens0dt1ex         | running / healthy                                            |            0 |
| supabase-auth-gawq4yyxiise96wens0dt1ex           | running / healthy                                            |            0 |
| supabase-supavisor-gawq4yyxiise96wens0dt1ex      | running / healthy                                            |            0 |
| supabase-edge-functions-gawq4yyxiise96wens0dt1ex | running / healthy                                            |            0 |
| coolify-sentinel                                 | running / healthy                                            |            0 |
| supabase-envoy-gawq4yyxiise96wens0dt1ex          | running / healthy                                            |            0 |
| imgproxy-gawq4yyxiise96wens0dt1ex                | running / healthy                                            |            0 |
| supabase-rest-gawq4yyxiise96wens0dt1ex           | running / sans healthcheck                                   |            0 |
| migration-public-repository-read-test            | exited (0), ancien diagnostic                                |            0 |
| migration-coolify-inspect                        | exited (2), ancien diagnostic ; ancien healthcheck unhealthy |            0 |

Les quatre redémarrages Realtime datent de la réactivation PostgreSQL pendant
la bascule. Les deux conteneurs de diagnostic se sont terminés avant la mise en
production, vers 15 h 40 et 14 h 37 respectivement. Ils n'ont pas été supprimés.

## Ressources, disque et système

- **8 vCPU** ; load 1/5/15 minutes **3,66 / 2,99 / 2,74**, contre
  **2,87 / 3,31 / 2,66** à 17 h 46. Les deux secondes vmstat mesurées montrent
  71–77 % de CPU idle et 0 % d'iowait : aucune saturation démontrée.
- PostgreSQL environ 159 % de CPU et RustFS 102 % au relevé Docker : ces
  pourcentages s'expriment par cœur et ne représentent pas la totalité des huit
  cœurs. Mesures ponctuelles, sans test de charge.
- RAM disponible **11 438 Mio**, contre 11 667 Mio à 17 h 46. Pas de swap,
  aucune pression mémoire récente dans PSI, aucun OOMKilled Docker et aucun
  événement OOM trouvé dans le journal depuis la réouverture.
- Racine : **192,35 Gio disponibles**, environ 20 % utilisés ; contre environ
  193 Gio libres au relevé arrondi précédent. Inodes utilisés : 6 %.
- Docker : images 15,71 Go, couches conteneurs 271,6 Mo, volumes 17,33 Go,
  cache de build nul. Aucun nettoyage exécuté.
- Échantillon I/O de deux secondes, sans iostat installé : 9 écritures/s,
  0,045 Mio/s, attente moyenne d'écriture 0,33 ms et activité disque 0,2 %.
  La pression I/O ponctuelle PSI était plus élevée lors du premier relevé
  (avg10 autour de 6 %) ; elle ne suffit pas à établir une saturation durable.
- Aucune unité systemd failed, aucune erreur disque/EXT4 récente détectée.
  Deux erreurs `systemd-ssh-generator` concernant AF_VSOCK à 17 h 45 sont
  présentes ; SSH TCP fonctionne. À examiner lors de la maintenance système.

| Volume Docker                                 | Taille logique affichée par Docker |
| --------------------------------------------- | ---------------------------------: |
| coolify-db                                    |                           142,5 Mo |
| coolify-redis                                 |                           722,6 ko |
| gawq4yyxiise96wens0dt1ex_deno-cache           |                           426,2 ko |
| gawq4yyxiise96wens0dt1ex_supabase-db-config   |                           17,82 ko |
| gawq4yyxiise96wens0dt1ex_supabase-db-data     |                            4,52 Go |
| gawq4yyxiise96wens0dt1ex_supabase-rustfs-data |                           12,65 Go |

Coolify Sentinel a consigné un timeout isolé de collecte des tailles Docker à
17 h 52. La collecte Docker fonctionne pendant cet audit. Deux avertissements
nginx Coolify indiquent une mise en tampon disque de réponses ; aucune erreur
HTTP correspondante. Ce sont des constats à suivre, pas des pannes démontrées.

## Tâches et absence de dépendance active à l'ancien VPS

Cron système actif ; pg_cron actif avec deux jobs configurés, **24 exécutions
réussies et zéro échec depuis l'ouverture** au relevé vers 18 h 04. Horizon
répond `Horizon is running` et son worker ainsi que `schedule:work` sont
présents. Coolify conserve six anciens jobs échoués, le plus récent à 01 h 29
le 23 octobre, **aucun nouvel échec depuis l'ouverture**.

Le timer `yokkai-storage-maintenance.timer` est actif, prochaine échéance
**20 h 00 min 42 s**. Son service n'a pas encore été exécuté par le timer sur ce
VPS ; son état inactive entre échéances est normal. Aucun lancement manuel n'a
été effectué. Son premier passage reste donc à observer.

Les connexions de l'hôte et des vingt espaces réseau de conteneurs ne montrent
aucun accès à `152.228.141.160` au relevé. Aucun endpoint effectif PostgreSQL,
Storage/S3, Auth, API ou label de routage inspecté n'utilise cette IP.
L'application résout `api.yokkai-collec.com` en **62.83.37.242**. Le serveur
géré dans Coolify est le compte local `coolify` sur `10.0.1.1:1022`.

**L'absence totale de référence à l'ancienne IP n'est cependant pas acquise :**

- les quatre variables générées `SERVICE_FQDN_SUPABASEKONG`,
  `SERVICE_URL_SUPABASEKONG` et leurs variantes `_8000` contiennent encore
  l'ancien nom `*.152.228.141.160.sslip.io` dans quatorze conteneurs Supabase ;
- elles restent dans le `.env` de la stack et le compose de production sauvegardé ;
- aucun consommateur de ces variables n'est trouvé dans les configurations
  montées inspectées ; les endpoints fonctionnels utilisent les services locaux
  et le domaine API correct ;
- les résultats de vérification DNS stockés dans Coolify datent des 10/12 octobre
  et mentionnent encore l'ancienne IP ; ce sont des caches historiques ;
- le stockage ACME contient encore des noms de certificats hérités. Aucun
  routeur actif vers l'ancienne IP n'a été trouvé.

**Aucune dépendance active n'est observée**, mais ces reliquats doivent être
revus et corrigés de manière cohérente avant un redéploiement. L'échantillonnage
des sockets et la lecture des configurations ne prouvent pas l'absence de toute
branche de code dormante. Aucun de ces éléments n'a été modifié pendant l'audit.

## Bilan

| Composant                             | État                              | Anomalies                                                                  | Action recommandée                                                |
| ------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Traefik / Yokkai                      | Opérationnel                      | Aucun nouveau 500/502/503/504 récent                                       | Conserver la surveillance HTTP                                    |
| PostgreSQL                            | Sain                              | Pas de blocage/deadlock ; journalisation serveur limitée à fatal           | Revoir le niveau de logs et la rétention                          |
| Requêtes catalogue                    | Opérationnel                      | Deux familles autour de 0,65–0,94 s de moyenne                             | Examiner les plans hors période chargée, sans changement immédiat |
| Auth / PostgREST / Storage / Realtime | Opérationnels                     | Aucune nouvelle panne observée                                             | Surveillance habituelle                                           |
| Images Storage                        | Saines sur l'échantillon          | Quatre lectures conformes                                                  | Aucune correction immédiate                                       |
| RustFS                                | À surveiller                      | Scans expirés, budget du scanner atteint, cache FD désactivé               | Observer les prochains cycles ; revue des limites et budgets      |
| Docker                                | Stable                            | Deux anciens diagnostics exited ; aucun service actif unhealthy/restarting | Conserver les témoins ; aucun nettoyage demandé                   |
| CPU / RAM / disque / I/O              | Marge disponible                  | RustFS proche d'un cœur ; PSI I/O ponctuel                                 | Suivre la tendance plutôt qu'un seul échantillon                  |
| Système                               | Fonctionnel                       | Deux erreurs AF_VSOCK du générateur SSH                                    | Examiner lors de la prochaine maintenance                         |
| Cron / Horizon / scheduler            | Actifs                            | Aucun nouvel échec ; premier timer système pas encore passé                | Observer la prochaine échéance de 20 h                            |
| Coolify Sentinel                      | Fonctionnel                       | Un timeout de collecte Docker                                              | Vérifier qu'il ne se répète pas                                   |
| Écritures utilisateur                 | Confirmées sur le nouveau VPS     | Aucune anomalie de continuité observée                                     | Préserver les données ; aucun rollback DNS aveugle                |
| Références à l'ancien VPS             | Pas de dépendance active observée | Variables générées et caches historiques encore présents                   | Corriger avant le prochain redéploiement                          |

**Conclusion : À SURVEILLER.**
