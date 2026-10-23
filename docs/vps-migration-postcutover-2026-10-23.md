# Migration VPS — rapport après bascule du 23 octobre 2026

**La production Yokkai Collec est maintenant sur `62.83.37.242`.** La réouverture
a été effectuée à **17 h 40, heure de Paris**, après le GO explicite, le gel de la
source, les restaurations, les comparaisons et les contrôles via Cloudflare.

L'ancien VPS `152.228.141.160` est conservé : application et writers arrêtés,
PostgreSQL en lecture seule avec connexions TCP applicatives rejetées et cron
désactivé. Aucun conteneur, volume, sauvegarde ou donnée source n'a été supprimé.
Ses conteneurs PostgreSQL, proxy et services auxiliaires conservés restent
disponibles pour les opérations de maintenance autorisées.

Les heures ci-dessous sont en Europe/Paris. Le
[rapport avant bascule](vps-migration-2026-10-23.md) reste la référence historique
pour l'architecture, les versions, l'inventaire et les préparatifs.

## Déroulement et autorisations

| Étape                         | Résultat / heure                                                                                                                                                 |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vérifications préalables      | Identités, sudo, espace disque, commit/image et 187 migrations inchangés ; configuration Cloudflare identique à l'audit approuvé                                 |
| Maintenance source            | 17 h 16 min 13 s : HTTP 503 non cachable sur le domaine canonique et l'API                                                                                       |
| Gel effectif source           | 17 h 17 min 32 s : writers arrêtés, jobs/cron désactivés, HBA rejette les nouvelles connexions TCP, aucune autre session cliente et compteurs d'écriture stables |
| Dumps finaux                  | Bases `postgres` et `_supabase`, références de comptage et empreintes, terminés vers 17 h 19 min 34 s                                                            |
| RustFS                        | Arrêt des deux instances ; dry-run examiné ; copie réelle ; second dry-run avec checksums sans écart à 17 h 30 min 53 s                                          |
| PostgreSQL destination        | Deux bases restaurées ; 101 comptages et 56 empreintes de contenu métier/Storage concordants à 17 h 32 min 37 s                                                  |
| Contrôles avant DNS           | Auth, profil, collection, catalogue, images, Storage et Realtime authentifié réussis                                                                             |
| Cloudflare                    | Six A relus, modifiés et revérifiés vers 17 h 34 ; attributs autres que `content` conservés                                                                      |
| Incident de maintenance       | Contrôle public 404 inattendu : arrêt, diagnostic, arrêt de protection des writers destination et demande d'autorisation ; correction approuvée puis effectuée   |
| Maintenance publique corrigée | 17 h 37 min 43 s : 503 depuis la nouvelle origine sur le domaine canonique et l'API                                                                              |
| Validation publique           | 17 h 38 min 27 s : contrôles fonctionnels réussis et preuve dans les journaux de la nouvelle origine                                                             |
| Réouverture                   | 17 h 40 min 03 s : maintenance destination retirée, pg_cron, Horizon, scheduler et valeurs applicatives de production réactivés                                  |
| Contrôles après réouverture   | Login réel, profil, collection, upload/download Storage, images et nettoyage des tests réussis à 17 h 42 min 56 s                                                |
| Maintenance système           | Timer existant activé sur la destination à 17 h 45 min 32 s ; prochaine échéance affichée à 20 h 00, sans nettoyage manuel déclenché                             |

La période entre activation de la maintenance source et réouverture représente
**environ 23 min 50 s**. Elle dépasse l'estimation initiale de 10–20 minutes et
reste dans la fenêtre réservée de 30 minutes. La durée comprend les lectures
intégrales de checksums RustFS et l'incident décrit ci-dessous. La maintenance
n'a pas été correctement routée sur la nouvelle origine pendant l'incident ;
le premier contrôle public a précisément détecté cette anomalie.

## Données finales et comparaison

| Donnée              | Source gelée et destination avant ouverture | Nouveau VPS à 17 h 46 min 30 s |
| ------------------- | ------------------------------------------: | -----------------------------: |
| Utilisateurs Auth   |                                          63 |                             63 |
| Profils             |                                          63 |                             63 |
| Cartes catalogue    |                                      91 810 |                         91 810 |
| Cartes possédées    |                                      22 770 |                         22 780 |
| Métadonnées Storage |                                     158 000 |                        158 000 |

Les **101 tables comptées** concordent avant ouverture. Le contrôle final est
plus large que les 94 tables du snapshot préparatoire : il inclut notamment les
tables `cron`, `net`, `supabase_functions` et `vault`. Les **56 empreintes de
contenu des tables métier et Storage** concordent également. Les mots de passe
et secrets n'ont pas été publiés sous forme de valeurs ou d'empreintes individuelles.

Le dump final reprend **235 cartes possédées supplémentaires** par rapport au
snapshot préparatoire de 22 535 cartes. Les dix cartes supplémentaires observées
après ouverture sont de nouvelles écritures de la production sur le nouveau VPS,
pas un écart de restauration. Les données continuent naturellement d'évoluer.

Les deux dumps ont été conservés sur la source et transférés avec vérification
des tailles, tables des matières et SHA-256 :

| Dump                                    |      Octets | SHA-256                                                            |
| --------------------------------------- | ----------: | ------------------------------------------------------------------ |
| `supabase-postgres-final-20261023.dump` |  40 426 992 | `6f19ba0e315c04ace54305ed25da689abd612f7af8392f685706329bfac147f5` |
| `supabase-internal-final-20261023.dump` | 206 998 164 | `437dd2e3c36da3766a6c9cb88cd601f2a6036bcb9caf4f28b69e7f200535c264` |

### RustFS / Storage

La synchronisation a utilisé un module rsync source **en lecture seule**, lié à
loopback, et deux tunnels SSH via le poste local. Aucune clé SSH privée n'a été
copiée. Le daemon et les tunnels temporaires ont ensuite été arrêtés.

Le dry-run avec `--checksum`, `--itemize-changes`, `--stats`, propriétaires
numériques et `--delete-delay` a été examiné avant exécution. Il prévoyait
**8 346 537 octets**, 35 fichiers réguliers transférés, 13 fichiers et 13
répertoires créés, ainsi que 29 fichiers et 29 répertoires supprimés uniquement
sur la destination. Les fichiers exclusifs à la destination ont été archivés
avant remplacement/suppression. Aucun fichier n'a été supprimé sur la source.

Le second dry-run avec les mêmes options et checksums confirme :

- **177 746 fichiers réguliers**, 335 781 répertoires ;
- **12 647 725 411 octets** de fichiers bruts RustFS, métadonnées internes incluses ;
- **0 fichier à transférer, 0 création, 0 suppression, 0 différence restante**.

Ce contrôle intégral porte sur les fichiers physiques. Il ne confond pas leur
nombre avec les 158 000 métadonnées d'objets Supabase. La comparaison de contenu
de la table Storage est conforme et les lectures d'images, buckets, upload et
téléchargement ont validé le fonctionnement réel de Storage/RustFS après bascule.

## Cloudflare après bascule

Les six enregistrements sont de type **A** ; seule leur valeur est passée de
`152.228.141.160` à `62.83.37.242` :

| Nom                         | Nouvelle origine | Proxy conservé | TTL API conservé |
| --------------------------- | ---------------- | -------------- | ---------------: |
| `yokkai-collec.com`         | `62.83.37.242`   | Activé         |                1 |
| `www.yokkai-collec.com`     | `62.83.37.242`   | Activé         |                1 |
| `api.yokkai-collec.com`     | `62.83.37.242`   | Activé         |                1 |
| `coolify.yokkai-collec.com` | `62.83.37.242`   | Désactivé      |                1 |
| `yokkai-collec.fr`          | `62.83.37.242`   | Activé         |                1 |
| `www.yokkai-collec.fr`      | `62.83.37.242`   | Activé         |                1 |

La relecture complète après bascule confirme l'identité des autres DNS,
paramètres TLS et règles par rapport à l'audit approuvé. Aucun AAAA n'a été
ajouté ou modifié, aucun CNAME/MX/TXT/SRV changé. Full strict, redirections 301,
cache désactivé pour l'API et autres règles sont conservés. Aucun Load Balancer,
Worker Route ou Page Rule n'était configuré dans ces deux zones.

Des requêtes publiques uniques sur le domaine canonique et l'API ont été
retrouvées dans `/data/coolify/proxy/migration-access.jsonl` sur le nouveau VPS.
Les réponses de maintenance portaient également son identité d'origine. Les
redirections Cloudflare des alias n'ont pas été utilisées seules comme preuve.

## Tests fonctionnels

- Domaine principal HTTPS 200 ; alias `www`/`.fr` en 301 ; Coolify en 302 vers
  sa connexion. Certificats de la nouvelle origine vérifiés avant routage.
- Auth health, lecture d'un utilisateur authentifié, profil par RPC et collection
  réelle : HTTP 200 avant DNS et via Cloudflare pendant la maintenance.
- Homepage, Profile, Collection, Catalog, Packs et Market : HTTP 200.
- Catalogue et six images existantes via Storage : HTTP 200, tailles vérifiées.
- Realtime : connexion WSS authentifiée, souscription et broadcast reçu, y
  compris via Cloudflare avant réouverture.
- Après ouverture : création d'un compte temporaire confirmé sans email réel,
  login par mot de passe, lecture Auth/profil/collection réussis.
- Upload d'un PNG de 79 octets via Storage, téléchargement public avec SHA-256
  identique et optimiseur Next d'une image existante : HTTP 200.
- Compte et fichier de test supprimés ; absence de leurs lignes vérifiée.
- Aucun paiement ni email réel de test exécuté ; valeurs applicatives de
  production restaurées depuis la configuration source.

Les parcours navigateur détaillés restent ceux du rapport préparatoire ; les
contrôles après bascule décrits ici sont HTTP/API/WebSocket, sans nouveau test
de présentation responsive ou de zoom.

## État des services et surveillance immédiate

À 17 h 46, les **20 services de la stack active** sont démarrés. Les 18 services
disposant de healthchecks sont sains ; Yokkai et PostgREST, sans healthcheck
Docker d'origine, sont vérifiés par HTTP/API.

PostgreSQL est en lecture/écriture et `cron.launch_active_jobs=on` sur la nouvelle
production. Les processus `php artisan horizon` et `php artisan schedule:work`
sont observés dans Coolify. Le timer système de maintenance existant est activé
uniquement sur la destination ; son script et son aide ont été vérifiés avant
activation. L'auto-update Coolify reste désactivé pour éviter un upgrade mêlé à
la migration.

Au dernier relevé : environ **193 Gio libres**, **11,4 Gio de RAM disponibles**,
charge proche de **2,9 pour 8 vCPU**. RustFS effectue du travail de fond proche
d'un cœur ; aucune saturation mémoire ou disque n'est observée. Les mesures sont
ponctuelles et ne constituent pas un test de charge.

Realtime a redémarré quatre fois pendant le redémarrage PostgreSQL nécessaire à
la réactivation de pg_cron. Il est redevenu sain ; son compteur reste stable
entre les relevés de 17 h 41 et 17 h 46. Les autres conteneurs actifs affichent
zéro redémarrage sur cette génération de conteneurs.

Les 503 de la fenêtre de maintenance sont attendus. Un 500 est attribué à la
requête de création du premier compte de test sans le champ `pseudo` requis,
et un 503 de catchall à un accès par IP littérale sans domaine configuré. Après
correction du jeu de test, les contrôles passent. Les statistiques ne sont pas
présentées comme une absence absolue d'erreurs historiques.

## Incident et correction autorisée

L'ajout par l'agent d'une exception réseau à la maintenance utilisait deux
adresses dans un seul matcher `ClientIP`, alors que Traefik attend un argument
par appel. Le routeur de maintenance a été rejeté. Les tests opérateur
fonctionnaient encore, mais ils ne prouvaient pas le maintien du 503 public.
Le premier contrôle public a détecté un 404 au lieu du 503 attendu.

La procédure a été arrêtée : aucun rollback DNS, aucun rétablissement de la source.
Les writers de la destination ont été arrêtés par protection, les comptages
vérifiés et l'utilisateur informé. Après son accord explicite, la syntaxe a été
corrigée en deux matchers reliés par OR. Le 503 public de la nouvelle origine a
été vérifié avant le redémarrage des services de test.

Un dump de précaution de la destination a été conservé et les **56 empreintes
métier/Storage sont restées identiques à la source gelée**. Les contrôles publics
ont ensuite été entièrement rejoués avant réouverture. Cette correction ne
modifie aucune règle Cloudflare et ne remplace ni ne supprime de donnée métier.

La requête initiale de compte de test incomplète a été corrigée en fournissant
le `pseudo` exigé par le produit. Aucun schéma, trigger, contrainte ou droit n'a
été affaibli pour faire passer le test.

## Sauvegardes, suite et rollback

- Source : `/mnt/disk/yokkai-migration-backup-20261023/`, avec états de gel,
  configuration originale permettant de revenir sur les réglages de maintenance,
  dumps initiaux/finals et journaux dans `cutover/`.
- Destination : `/home/debian/yokkai-migration-20261023/`, avec copies vérifiées,
  configuration `compose-production.json`, preuves de comparaison, de routage,
  tests, surveillance et sauvegarde de précaution dans `cutover/`.
- Export Cloudflare avant/après et reçus des six changements conservés hors Git,
  dans les dossiers locaux protégés de la mission. Les secrets restent hors Git.

**Des écritures réelles ont eu lieu sur le nouveau VPS. Aucun rollback DNS aveugle
vers l'ancien serveur n'est autorisé.** Tout retour nécessiterait de geler la
nouvelle production, sauvegarder et préserver/réconcilier ses nouvelles données,
puis faire valider la procédure appropriée avant modification.

L'ancien VPS ne doit pas être supprimé. La suite relève de l'observation de la
nouvelle production et de la politique de rétention des sauvegardes, sans tâche
automatique de suivi créée par cette opération.

## Portée Git

Documentation uniquement : aucun changement applicatif, test ou nouvelle
migration Supabase. Aucun upgrade majeur n'a été effectué. Les migrations déjà
présentes ont été restaurées avec les bases ; aucune nouvelle migration n'a été
appliquée dans cette mission. Les vérifications complètes du dépôt restent
exécutées par GitHub Actions.
