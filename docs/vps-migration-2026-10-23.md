# Migration VPS — rapport avant bascule du 23 octobre 2026

**Statut : copie fonctionnelle préparée sur `62.83.37.242` ; aucune bascule effectuée.**
La production reste sur `152.228.141.160`. Aucune modification Cloudflare/DNS,
aucun arrêt de service de production et aucune suppression de données, conteneurs
ou volumes de l'ancien VPS n'ont été effectués. L'ancien serveur a reçu uniquement
des fichiers de sauvegarde ; les autres opérations y étaient des lectures.

Les heures du rapport sont en Europe/Paris, sauf mention UTC explicite.

## 1. Architecture réellement détectée

```text
Domaines publics / Cloudflare
  └─ ancien VPS 152.228.141.160
      └─ Traefik (coolify-proxy, HTTP/HTTPS)
          ├─ Yokkai Next.js :3000, réseau coolify
          ├─ interface Coolify
          └─ api.yokkai-collec.com → Envoy, réseau Supabase
              ├─ Auth / GoTrue
              ├─ PostgREST → PostgreSQL :5432
              ├─ Realtime → PostgreSQL
              ├─ Storage :5000 → PostgreSQL (métadonnées)
              │                  └─ RustFS :9000 (objets S3)
              ├─ fonctions Edge / Deno
              └─ Studio, postgres-meta, Logflare, Supavisor, Vector, imgproxy

Coolify → PostgreSQL 15 séparé + Redis + Sentinel
```

Les réseaux applicatifs sont `coolify` (`10.0.1.0/24`) et
`gawq4yyxiise96wens0dt1ex` (`10.0.2.0/24`). Traefik appartient aux deux.
Le domaine public Supabase reste `https://api.yokkai-collec.com`.

Le stockage est effectivement configuré avec `STORAGE_BACKEND=s3`, endpoint
`http://supabase-rustfs:9000`, bucket physique `stub`, région `us-east-1`,
adressage par chemin et tenant `storage-single-tenant`. Les buckets logiques
Supabase sont `avatars`, `card-images` et `profile-wall-media`.

## 2. Versions conservées

Les images publiques ont été téléchargées avec les **digests de production**.
L'image Yokkai a été exportée depuis l'ancien serveur et chargée sur le nouveau.

| Composant           | Version / image conservée                                    |
| ------------------- | ------------------------------------------------------------ |
| OS                  | Debian 13.7 sur les deux VPS ; noyaux fournisseurs distincts |
| Docker Engine       | 29.8.1                                                       |
| Compose             | 5.5.1                                                        |
| containerd          | 2.3.5                                                        |
| Coolify             | 4.4.7                                                        |
| PostgreSQL Supabase | 17.6, image `supabase/postgres:17.6.1.136`                   |
| PostgreSQL Coolify  | 15.19, digest de `postgres:15-alpine`                        |
| Redis               | 7.4.11, digest de `redis:7-alpine`                           |
| Auth                | `supabase/gotrue:v2.196.0`                                   |
| Realtime            | `supabase/realtime:v2.134.10`                                |
| Studio              | `2026.09.07-sha-7996410`                                     |
| Storage             | `supabase/storage-api:v1.74.0`                               |
| RustFS              | `rustfs/rustfs:1.0.0`                                        |
| PostgREST           | v14.17                                                       |
| Envoy               | v1.39.1                                                      |
| Traefik             | v3.6, digest identique                                       |
| Logflare            | 1.50.10                                                      |
| Supavisor           | 2.9.12                                                       |
| postgres-meta       | v0.99.0                                                      |
| Edge Runtime        | v1.76.2                                                      |
| Vector              | 0.53.0-alpine                                                |
| imgproxy            | v3.31.4                                                      |
| Sentinel            | 1.1.2                                                        |
| Helper Coolify      | 1.0.17, digest identique                                     |

Application : dépôt `TheGreatToba/yokkai-collec`, branche `master`, commit déployé
`04a75b38fb72e79300c951b806ef13fc5070a2fb`. Le dépôt public a été vérifié par
`git ls-remote` depuis le nouveau VPS. Aucun nouveau build applicatif ni upgrade
majeur n'a été mélangé à la migration.

## 3. Données persistantes identifiées

| Données                                     | Emplacement de production                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Bases Supabase `postgres` et `_supabase`    | volume `gawq4yyxiise96wens0dt1ex_supabase-db-data`                                                                 |
| Configuration PostgreSQL et clé pgsodium    | volume `gawq4yyxiise96wens0dt1ex_supabase-db-config`                                                               |
| Objets RustFS                               | volume `gawq4yyxiise96wens0dt1ex_supabase-rustfs-data`, monté sur `/data`                                          |
| Cache Deno                                  | volume `gawq4yyxiise96wens0dt1ex_deno-cache`                                                                       |
| Configuration Supabase, fonctions, snippets | `/data/coolify/services/gawq4yyxiise96wens0dt1ex/`                                                                 |
| Configuration et environnement Yokkai       | `/data/coolify/applications/lbugcql3gc8ijtbv7qqy70do/`                                                             |
| Base Coolify                                | volume `coolify-db`                                                                                                |
| Redis Coolify                               | volume `coolify-redis`, cache/queue recréés sur la destination                                                     |
| Proxy et certificats                        | `/data/coolify/proxy/`, notamment `acme.json`                                                                      |
| Installation Coolify                        | `/data/coolify/source/` et base `coolify`                                                                          |
| Maintenance personnalisée                   | `/opt/yokkai-ops`, `/usr/local/sbin/yokkai-storage-maintenance`, unités systemd et fichier `/etc/default/` associé |

Yokkai ne monte aucun volume applicatif local : ses données métier et fichiers
utilisateur sont dans Supabase/RustFS. Les répertoires de cache ne sont pas des
uploads locaux.

Les anciens volumes Supabase non attachés, le cache BuildKit d'environ 8,6 Gio
et les archives historiques déjà présentes restent conservés sur l'ancien VPS.
Ils ne sont pas utilisés par la stack active restaurée. Les anciennes sauvegardes
Coolify de `/data/coolify/backups` restent sur l'ancien VPS ; les sauvegardes
créées pour cette migration sont disponibles sur les deux serveurs. Le répertoire
`/data/coolify/images` ne contient aucun fichier à transférer.

## 4. Sauvegardes réalisées

Ancien VPS : `/mnt/disk/yokkai-migration-backup-20261023/`.
Destination : `/home/debian/yokkai-migration-20261023/`.
Ces répertoires sont protégés et ne sont pas inclus dans Git.

- Dumps logiques des deux bases Supabase et de la base Coolify.
- Rôles globaux PostgreSQL, paramètres de base et droits SQL.
- Dump applicatif de référence et comptages des 94 tables dans **le même snapshot**.
- Configurations Docker/Compose, environnements, montages et inventaires.
- Configuration PostgreSQL, clé pgsodium conservée après accord explicite.
- Pré-copie complète RustFS, cache Deno, configurations et certificats du proxy.
- Image Yokkai réellement déployée et inventaire des digests.
- Scripts systemd/maintenance et archive de sept scripts d'import, non exécutés.
- Complément de 14 objets S3 et leurs métadonnées d'origine.

Les clés SSH privées d'origine ont été exclues. Le dump Coolify initial exclut
les valeurs de `private_keys` et conserve leurs métadonnées non secrètes. Après
autorisation explicite, seule la clé de signature API de la GitHub App a été
exportée sous sa forme chiffrée puis restaurée dans le nouveau Coolify. L'audit
confirme qu'elle n'est référencée par aucun accès SSH serveur ou déploiement.
Les secrets applicatifs, JWT, Auth, S3 et SMTP nécessaires ont été conservés sans
publication de leur valeur.

## 5. État du nouveau VPS

Identité vérifiée : `v2202610443055544511`, IPv4 `62.83.37.242`, utilisateur
`debian`, `sudo -n whoami` → `root`.

8 vCPU AMD EPYC virtuels, environ 16 Gio de RAM, disque virtuel de 256 Gio.
Après restauration : environ 194 Gio disponibles, 11 Gio de RAM disponibles,
charge observée proche de 2,5 pour 8 vCPU. Aucun swap n'a été ajouté.
La nature NVMe du support physique n'est pas vérifiable depuis le disque virtuel
exposé par l'hyperviseur.

## 6. Composants installés et isolement

Les 20 conteneurs de la stack active sont démarrés sur la destination. Les
healthchecks présents dans la production ont été repris. Yokkai et PostgREST
n'ont pas de healthcheck Docker dans la configuration source ; ils ont été
contrôlés par HTTP/API et navigateur.

Pendant la préparation : réseaux Docker internes, cron PostgreSQL inactif,
Horizon et scheduler Coolify désactivés, auto-update Coolify désactivé, paiements
désactivés sur la copie. Les emails et appels Stripe réels n'ont pas été exécutés.

L'application résout son API vers **le nouveau VPS**. Pour respecter la protection
Next contre les IP privées, une route limitée à `62.83.37.242/32` et un relais TLS
temporaire sur ce serveur acheminent les requêtes vers son Traefik. Le relais
n'accepte que ses clients locaux/de test. Aucun DNS public n'a été modifié.
L'accès TCP à `152.228.141.160:443` depuis Yokkai a été vérifié bloqué.
La route est liée au conteneur courant et le relais est une unité transitoire :
un redémarrage du VPS ou une recréation du conteneur impose de rétablir le
dispositif de validation puis de refaire les contrôles avant la bascule.

Après accord explicite, un nouveau compte technique `coolify`, une nouvelle clé
SSH locale et les privilèges administrateur explicitement approuvés ont été
configurés sur la destination. Le mécanisme SSH officiel de Coolify a exécuté
`hostname`, `sudo -n whoami` et une lecture Docker sur **le nouveau VPS**.
L'intégration GitHub App d'origine est conservée, avec sa clé de signature API
restaurée après autorisation explicite. Le déchiffrement dans Coolify et une
signature/vérification RSA locale ont réussi ; aucun déclenchement GitHub réel
n'a été exécuté depuis la copie isolée. Aucune ancienne clé de déploiement SSH
n'a été copiée. Port SSH, `sshd_config` et règles firewall SSH sont inchangés.

## 7. Transferts vérifiés

Transfert SSH chiffré via le poste local, sans clé SSH privée copiée sur un serveur.
Les fichiers pouvaient reprendre à leur offset en cas d'interruption.
Les SHA-256 de chaque fichier transféré ont été comparés des deux côtés.
Les propriétaires et modes des données RustFS ont été conservés par l'archive.

| Archive importante                |         Octets | SHA-256                                                            |
| --------------------------------- | -------------: | ------------------------------------------------------------------ |
| `supabase-postgres-baseline.dump` |     40 408 839 | `85681b03eb1314627d31c88978c26dfcaf47ba0d70202fab9aee3c92955588b2` |
| `supabase-internal.dump`          |    206 380 849 | `e968c3df91e5d3d6ebdb663c401ba012cfe80ca394d868356ea44db8e8bf77a6` |
| `rustfs-precopy.tar`              | 13 484 974 080 | `d64c71a3979ed8e9a76054e6fd029795c8f8261d7d70a0fd15c86080a3216160` |
| `rustfs-baseline-delta.tar`       |      2 867 200 | `37767cc46b8ac952ac31c4c3bfcbc5d22e68266afa70ac558a9628323b3c8dcf` |
| `yokkai-image.tar.gz`             |    789 432 926 | `90a3707e5c8155ae09b7367a2b365cdac453f555223f0bfc2d1969b5181ff503` |

## 8. Résultat PostgreSQL

Les trois dumps ont été restaurés et leurs tables des matières ont été vérifiées.
Aucun répertoire de données PostgreSQL actif n'a été copié comme sauvegarde.

Les contrôles portent sur 8 extensions, 13 schémas applicatifs, 113 relations,
887 colonnes, 362 fonctions, 284 index, 388 contraintes, 104 triggers et 32
politiques RLS. Les définitions logiques correspondent. Deux contraintes ont
uniquement une parenthésation équivalente normalisée par la restauration ; les
numéros physiques des colonnes supprimées ne sont pas recréés par un dump logique.

Les droits effectifs de 488 objets, 30 ensembles de privilèges par défaut,
31 rôles, 25 appartenances de rôles et 15 entrées de privilèges de bases ont été
comparés à la source. Aucun droit supplémentaire ne subsiste dans ces contrôles.
Il n'existe aucun privilège par colonne spécifique dans la source.

## 9. Comparaison des données PostgreSQL

Référence exportée le 23 octobre à environ 14 h 33, snapshot
`0000003B-000039FC-1`. Les **94 tables comptées dans ce snapshot correspondent
exactement après restauration**.

| Donnée              | Snapshot source | Copie après nettoyage des tests |
| ------------------- | --------------: | ------------------------------: |
| Utilisateurs Auth   |              63 |                              63 |
| Profils             |              63 |                              63 |
| Cartes de catalogue |          91 810 |                          91 810 |
| Cartes possédées    |          22 535 |                          22 535 |
| Métadonnées Storage |         158 000 |                         158 000 |

**La production reste active et évolue.** Au contrôle du 23 octobre à 15 h 40
(13 h 40 UTC), elle contient déjà **22 660 cartes possédées**, soit 125 de plus
que la référence. Ces écritures restent sur la production ; le dump final devra
les reprendre avant la bascule. Le présent rapport ne prétend pas que la copie
est déjà synchronisée avec chaque écriture en cours.

La base applicative source occupait environ 529 Mo au dernier contrôle, contre
environ 340 Mo après restauration logique ; la base interne environ 3,19 Go
contre 3,14 Go. La différence physique ne constitue pas un écart de comptage.
Les journaux et sessions évoluent aussi lors des démarrages/tests.

## 10. Résultat Supabase

API, PostgREST, Studio, postgres-meta, Logflare, Supavisor, Vector et fonctions
Edge démarrés. Les healthchecks existants sont sains. Les tables et fonctions
métiers sont présentes. Les accès directs aux tables protégées restent refusés,
et les RPC effectivement utilisées par l'application fonctionnent.

## 11. Résultat Auth

Création d'un compte temporaire sur la copie sans email envoyé, connexion par
mot de passe, lecture de l'utilisateur, lecture et modification du profil via
RPC : réussies. Les mots de passe existants, identités, clés et configuration
Auth ont été restaurés par le dump et l'environnement conservé.
Le compte de test a été supprimé après les parcours navigateur.

## 12. Résultat RustFS

Le volume restauré a démarré avec la version et les credentials source.
L'inventaire S3 complet a été effectué **sur la destination**, pour éviter la
charge sur la production. Les 14 objets complémentaires ont été contrôlés après
restauration par SHA-256 et leurs métadonnées S3 d'origine ont été rétablies.

## 13. Résultat Storage

Upload via la route Yokkai `/api/profile-media`, téléchargement via Storage/RustFS
avec contenu identique, lecture de six images de cartes existantes et relecture
des 14 objets complémentaires via Storage : réussis.
L'optimiseur Next a renvoyé HTTP 200 pour une carte existante avec sa protection
contre les IP privées inchangée. Le fichier de test a été supprimé.

## 14. Comparaison des objets

L'archive initiale contenait 177 738 fichiers ordinaires, pour 12 646 686 814
octets de contenu brut, incluant les métadonnées internes RustFS.

L'inventaire S3 initial restauré comptait 157 994 objets, soit 12 538 019 908
octets de données S3. La comparaison exhaustive avec les 158 000 lignes Storage
du snapshot a identifié 14 clés manquantes et 8 anciennes clés supplémentaires.
Les 14 clés ont été récupérées par lecture ciblée depuis la source, puis vérifiées
sur la destination. **Les 158 000 clés référencées sont présentes et leurs tailles
concordent.** Les 8 anciennes clés sont conservées ; aucune purge n'a été lancée.

Le jeu reconstitué contient donc 158 008 objets, soit 12 540 848 110 octets, hors
objet temporaire de test supprimé. Il s'agit du jeu de référence complété, pas
d'une garantie de synchronisation avec les écritures futures de la production.

## 15. Résultat des tests Yokkai

- HTTPS valide pour le domaine principal, `www`, les deux alias `.fr`, l'API et
  Coolify. Homepage et routes principales contrôlées en HTTP 200 ; Coolify redirige
  normalement vers sa connexion.
- Parcours navigateur authentifiés : Profile, Collection, Catalog, Packs, Market.
  Profil temporaire réellement affiché et aucune image cassée dans ces contrôles.
- Market contrôlé à 320, 375, 768, 1024 et 1440 px : aucun débordement de page.
  Aucun code d'interface n'a été changé ; le zoom à 200 % n'a pas été contrôlé.
- Ouverture d'un pack de cinq cartes pour le compte temporaire, lecture de sa
  collection et verrouillage d'une carte : réussis ; données de test nettoyées.
- Realtime : souscription authentifiée et broadcast reçu.
- Contrôle des connexions : API vers le nouveau serveur, ancien VPS inaccessible
  depuis le conteneur applicatif.
- Les requêtes SSR mesurées lors du contrôle étaient environ entre 0,17 et
  0,48 seconde, sans stress test. Ce ne sont pas des mesures de charge publique.

Les tests navigateur utilisaient un profil temporaire et un proxy qui acheminait
uniquement les domaines Yokkai vers le nouveau VPS. Les domaines externes étaient
bloqués. Les paiements réels, emails SMTP et intégrations externes ne sont donc pas
validés par ces tests isolés.

## 16. Problèmes rencontrés

- Le sudo non interactif était initialement absent sur la destination ; il a été
  configuré par l'utilisateur avant la reprise.
- La pré-copie RustFS vivante a signalé un répertoire modifié pendant la lecture.
  Elle n'a pas été assimilée à un snapshot cohérent avec PostgreSQL.
- L'inventaire S3 paginé était coûteux sur la production ; ce processus d'audit a
  été arrêté, puis l'inventaire exhaustif a été effectué sur le nouveau serveur.
- Les privilèges par défaut de l'instance PostgreSQL neuve avaient ajouté des
  droits absents de la source, notamment une appartenance de rôle supplémentaire.
- Les valeurs SSH exclues de la base Coolify devaient être représentées dans son
  format de chiffrement, même pour la métadonnée volontairement vide.
- L'optimiseur Next refusait le chemin de test utilisant une IP privée.

## 17. Corrections effectuées

Restauration des privilèges et paramètres source, retrait du rôle supplémentaire,
contrôle de toutes les appartenances, complément S3 des 14 objets, conservation
de leurs métadonnées, correction des métadonnées Coolify expurgées et nouveau
chemin TLS de validation. La clé pgsodium, la nouvelle administration SSH
Coolify et la restauration de la clé de signature API GitHub App ont fait l'objet
d'accords explicites de l'utilisateur. Les métadonnées de clés Coolify ont été
vérifiées après restauration et l'intégration GitHub App d'origine est rétablie.
Ces corrections concernent exclusivement la destination.

## 18. Points restant à traiter à la bascule

- Synchronisation finale des données et des éventuels changements de déploiement
  survenus après le snapshot de référence.
- Passage des réseaux/ports de validation à la configuration de production,
  retrait du relais et de la route temporaires ; activation ordonnée des sorties
  réseau et des tâches, puis reprise des valeurs de paiement source.
- Réactivation du scheduler/Horizon Coolify et des tâches métier une fois le
  routage validé. Les anciens scripts de maintenance ont été archivés mais ne
  sont pas activés automatiquement sur le nouveau serveur.
- Lecture/export des **vrais enregistrements et paramètres Cloudflare** avant
  toute modification. Aucun accès Cloudflare de gestion n'a été utilisé ; la
  recherche de connecteur disponible n'en a trouvé aucun. Les enregistrements
  d'origine cachés derrière le proxy Cloudflare ne sont pas déduits du DNS public.
- Vérifications contrôlées des intégrations externes après levée de l'isolement.

## 19. Durée de coupure estimée

Prévoir une fenêtre de **10 à 20 minutes**, à confirmer après réévaluation du delta
et de l'état courant. Le transfert complet de 13,5 Go est déjà effectué ; la
bascule prévoit une synchronisation incrémentale. La durée réelle dépendra du
scan des fichiers, des nouvelles écritures, des dumps finaux et des contrôles.
Aucune promesse de coupure nulle n'est faite.

## 20. Procédure de bascule prévue — NON EXÉCUTÉE

**Condition préalable : autorisation explicite de l'utilisateur.**

1. Vérifier `hostname`, `hostname -I` et `sudo -n whoami` sur les deux serveurs.
   Recontrôler le commit/image source, les migrations et les fichiers de stack.
   Préparer les éventuels écarts avant la maintenance. Suspendre les déploiements
   concurrents pour la fenêtre avec les développeurs.
2. Lire/exporter la zone Cloudflare réelle : types, valeurs, identifiants, proxy,
   TTL, éventuelles règles d'origine et destinations IPv6. Le périmètre à examiner
   est `yokkai-collec.com`, `www.yokkai-collec.com`, `yokkai-collec.fr`,
   `www.yokkai-collec.fr`, `api.yokkai-collec.com` et `coolify.yokkai-collec.com`.
   Un CNAME déjà dirigé vers un nom conservé n'a pas à être remplacé par un A.
3. Sur l'ancien VPS, ajouter un fichier de maintenance dédié dans
   `/data/coolify/proxy/dynamic/` : route prioritaire pour les domaines joueurs et
   API, service Traefik sans serveur, réponse 503. Vérifier la réponse avant de
   poursuivre. Conserver les fichiers et conteneurs existants.
4. Suspendre les automatismes Coolify de la source et arrêter temporairement les
   conteneurs qui peuvent écrire : application, Auth, REST, Realtime, Storage,
   fonctions Edge, Studio/meta, Supavisor et analytics. Conserver leurs noms et
   configurations pour le redémarrage. Ne supprimer aucun conteneur ou volume.
5. Sauvegarder les paramètres source puis désactiver le lancement des jobs cron
   PostgreSQL (`cron.launch_active_jobs=off`, rechargement). Appliquer le verrou
   de lecture seule de la base `postgres` pour les nouvelles sessions, fermer les
   connexions applicatives restantes et vérifier l'absence d'écritures en cours.
   Une interface de maintenance seule ne constitue pas ce verrou.
6. Créer de nouveaux dumps logiques et comptages de référence sur la source gelée :

   ```sh
   docker exec supabase-db-gawq4yyxiise96wens0dt1ex \
     pg_dump -U supabase_admin -d postgres -Fc > postgres-final.dump
   docker exec supabase-db-gawq4yyxiise96wens0dt1ex \
     pg_dump -U supabase_admin -d _supabase -Fc > internal-final.dump
   ```

   Les exécuter sous sudo dans un répertoire privé, vérifier les codes retour,
   tailles, tables des matières et SHA-256 ; réexporter les rôles et droits si
   l'audit a constaté des changements. Garder ces fichiers sur la source.

7. Arrêter les consommateurs sur la destination, dont RustFS pour le transfert
   brut final de son volume. Synchroniser le delta exact du répertoire source
   `/var/lib/docker/volumes/gawq4yyxiise96wens0dt1ex_supabase-rustfs-data/_data/`
   vers le même volume sur la destination, avec propriétaires, modes et contrôle
   d'intégrité. Utiliser rsync par tunnels SSH avec relais local, sans clé privée
   copiée ni agent privé installé sur un VPS. Examiner un dry-run avant toute
   suppression sur la **destination**, puis aligner les objets supprimés sur la
   source gelée. Aucune suppression n'est effectuée sur la source.
8. Transférer et vérifier les dumps finaux, puis restaurer sur la destination
   isolée. Les paramètres de gel propres à la maintenance ne doivent pas rester
   actifs sur la future base de production. Conserver les sauvegardes initiales
   et finales, ainsi que la nouvelle clé de gestion Coolify de la destination.
9. Refaire les comparaisons des tables métier, Auth, clés/tailles Storage et droits.
   Tester Auth, images, Storage, Realtime et pages avant tout changement de routage.
   En cas d'écart inexpliqué, ne pas basculer.
10. Sur le nouveau VPS seulement, remplacer le dispositif de validation par des
    réseaux/ports de production, ouvrir le service HTTP/HTTPS normal, retirer le
    relais temporaire, garder les anciennes écritures bloquées et les tâches de
    la copie arrêtées jusqu'au passage de trafic. Revalider TLS et les parcours
    avec résolution forcée vers la nouvelle origine.
11. Modifier uniquement les destinations d'origine Cloudflare effectivement
    identifiées : IPv4 `152.228.141.160` → `62.83.37.242` ; traiter aussi une
    éventuelle origine AAAA `2001:41d0:404:200::9c6a` →
    `2a03:4000:6:a1d3:78a4:46ff:fefe:6029`, selon la zone exportée. Conserver les
    paramètres proxy/TLS/TTL et règles existants sauf nécessité validée. Vérifier
    que les requêtes publiques atteignent la nouvelle origine.
12. Reprendre les valeurs de production des fonctionnalités de paiement et les
    sorties réseau nécessaires, puis les tâches métier et la gestion Coolify dans
    un ordre contrôlé. Ne pas déclencher de paiement ni email de test non prévu.
    Surveiller HTTP 4xx/5xx, logs, PostgreSQL, CPU/RAM/disque et redémarrages.
    Refaire immédiatement connexion, profil, collection, images, upload/relecture.
13. Laisser l'ancien VPS et ses sauvegardes intacts, en maintenance/lecture seule
    tant que du trafic ancien pourrait encore l'atteindre. Ne pas le supprimer.

Cette procédure doit être exécutée avec les identifiants Cloudflare réellement
lus à l'étape 2 ; elle n'invente aucun identifiant de zone ou d'enregistrement.

## 21. Procédure de rollback prévue — NON EXÉCUTÉE

**Avant toute écriture sur le nouveau VPS :** remettre la destination en
maintenance, rétablir dans Cloudflare les valeurs exactes exportées avant bascule,
puis restaurer les paramètres de lecture/cron de l'ancien PostgreSQL. Redémarrer
les conteneurs source conservés, contrôler Auth/API/Storage/images, retirer le
seul fichier de maintenance ajouté par la migration et vérifier le trafic.
Ne réactiver les tâches et écritures que sur le serveur redevenu autoritaire.

**Après des écritures sur le nouveau VPS :** geler d'abord les écritures des deux
côtés, sauvegarder le nouvel état PostgreSQL/RustFS et analyser les écritures
apparues depuis la bascule. Préserver ou réconcilier ces données avant tout retour
à l'ancienne base. Une restauration inverse sur l'ancien VPS nécessite une
procédure revue et l'autorisation appropriée ; aucun retour DNS aveugle vers une
base devenue obsolète n'est prévu. Une correction du nouveau VPS peut être
préférable à une réconciliation risquée.

**Aucun ancien serveur, volume, conteneur, secret ou backup ne doit être supprimé
après la migration sans une décision distincte de l'utilisateur.**

## Portée Git et validation CI

Cette PR documente l'opération ; elle ne modifie ni code applicatif ni test et
n'ajoute aucune migration Supabase. Aucune migration n'a été appliquée sur la
production dans cette mission. Les restaurations et corrections de droits ont
été effectuées uniquement sur la destination. La CI complète relève de GitHub
Actions, conformément aux consignes du dépôt ; aucun `verify`, `ci` ou `ci:db`
complet n'a été lancé localement.
