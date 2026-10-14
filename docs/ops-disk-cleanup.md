# Nettoyage du disque : état et procédure proposée

## Incident du 14 octobre 2026

Audit par SSH d'exploitation, sans clé API admin ni service_role. À 17:29 UTC,
la partition racine de 74 Gio affichait 71 Gio utilisés, 0 disponible et 100 %.
Les inodes étaient à 32 %. Les deux PostgreSQL (Supabase et Coolify) échouaient
avec `could not write lock file "postmaster.pid": No space left on device`.

Walid a ensuite demandé un nettoyage d'urgence. Aucun helper de déploiement
Coolify ni service de maintenance actif n'était présent avant les deux commandes.
La première purge de cache avec `--keep-duration 2h` n'a récupéré que 8,19 Ko.
La seconde commande autorisée, limitée au cache interne inutilisé, a été :

```sh
sudo docker exec buildx_buildkit_coolify-railpack0 buildctl prune --keep-storage 2048 --all
```

BuildKit a annoncé 5,22 Go récupérés et environ 2,03 Go de cache restant.
Le disque est passé à 94 %, avec 4,7 puis 4,6 Gio libres. À 17:34 UTC,
les conteneurs Supabase et Coolify étaient sains et les routes publiques
`/`, `/connexion`, `/inscription` retournaient 200. Aucun redémarrage manuel.
Aucune image, sauvegarde, base, réseau ou volume n'a été supprimé ou modifié.
La commande ne limite que le cache récupérable : ce n'est pas une limite dure
de la taille totale lorsque des entrées sont utilisées.

Contrôle ultérieur à 23:05 UTC : 15 Gio libres, occupation de 80 %, application et
Supabase/Coolify en marche, trois routes toujours à 200. Cette amélioration
supplémentaire est extérieure à notre purge ; son origine reste à confirmer.
À 23:09 UTC, sept images applicatives restent présentes. Le script installé est
inchangé ; la diminution du nombre des images est également extérieure à notre intervention.

## Ce qui existe déjà

| État                       | Constat                                                                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| En place                   | Script `/usr/local/sbin/yokkai-storage-maintenance`, modifié le 13 octobre à 22:07 UTC ; timer quotidien à 03:30 Europe/Paris, décalage aléatoire de 30 minutes. |
| En place                   | Images inutilisées âgées de sept jours ; cache Railpack avec `--keep-duration 168h --keep-storage 2048`.                                                         |
| En place                   | Docker `json-file`, 10 Mo par fichier et trois fichiers ; paramètres présents sur tous les conteneurs inspectés.                                                 |
| En place                   | Journald : `SystemMaxUse=200M`, `RuntimeMaxUse=50M`, `MaxRetentionSec=7day`.                                                                                     |
| Partiel                    | Avertissements à 80 % et 90 % via `logger`, uniquement lors du passage quotidien ; aucune livraison Discord démontrée.                                           |
| Partiel                    | Purge des sauvegardes après 14 jours ; pas de plafond à sept quotidiennes ni de protection explicite de la dernière copie.                                       |
| Non présent dans ce script | Verrou flock, simulation, protection des dernières images par nombre, contrôle des déploiements, mesure avant/après et fréquence de plusieurs passages par jour. |
| À vérifier                 | Valeurs et historiques du nettoyage Coolify, responsabilité des changements hors Git ; copie extérieure différée pendant la bêta.                                |

Le passage du 14 octobre à 01:35 UTC a récupéré 0 octet côté images/cache/journaux,
puis annoncé 72 % d'occupation. Les builds ultérieurs ont rempli le disque.
Le filtre de sept jours protège presque tous les déchets de builds récents.
Ne pas lancer le script complet pour résoudre l'urgence : il purge aussi les sauvegardes.

Le dépôt contient le plan Railpack de la PR #185 et le runbook de restauration
de la PR #225, tous deux mergés. La PR #222 d'AbdouDembele relance le webhook
Coolify après un ancien déploiement orphelin ; elle ne versionne pas de nettoyage.
La notification Discord GitHub annonce des commits, pas l'espace disque.
Aucune PR récente ouverte de nettoyage disque n'a été trouvée.
`scripts/deploy-migrations.sh` garde dix archives de son propre motif ; cette
politique distincte doit être harmonisée avec le runbook, sans lancer ce script.

## Occupation et protection

Tailles arrondies ; relevés non atomiques. Ne pas additionner couches partagées
Docker, fichiers containerd et tailles logiques des images.

| Catégorie                        | Mesure                                                                  | Traitement                                                     |
| -------------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Images et snapshots containerd   | Environ 40 Gio physiques                                                | À valider : images applicatives ciblées uniquement.            |
| Stockage RustFS Supabase         | 12,02 Go logiques Docker avant purge                                    | Ne pas toucher.                                                |
| Cache Railpack                   | 7,25 Go avant ; 2,03 Go après                                           | Cache inutilisé seulement ; reconstruit lors des builds.       |
| Volume PostgreSQL Supabase       | 2,827 Go logiques Docker                                                | Ne pas toucher.                                                |
| Bases PostgreSQL                 | `_supabase` 2,221 Go ; `postgres` 506 Mo                                | Mesures par SELECT en transaction READ ONLY, sans écriture.    |
| Sauvegardes Coolify              | 1,4 Gio                                                                 | Purge bêta ciblée proposée ; dernière copie toujours protégée. |
| Autres dumps                     | Environ 483 Mio dans /var/backups, 330 Mo sous le compte d'exploitation | Hors périmètre proposé ; données de joueurs.                   |
| Journaux système                 | Environ 206 Mio ; journald initialement 180 Mio                         | Déjà plafonnés ; faible gain attendu.                          |
| Répertoires de conteneurs Docker | 131 Mio                                                                 | Rotation existante ; aucune suppression directe.               |
| Cache apt                        | 94 Mio                                                                  | À valider, faible intérêt.                                     |
| WAL                              | 80 Mio SQL, environ 81 Mio physiques                                    | Ne jamais supprimer ; pas de problème de taille démontré.      |
| Temporaires                      | /var/tmp 16 Kio ; /tmp 12 Kio, en mémoire                               | Aucun gain significatif.                                       |

Les sept volumes sans conteneur attaché restent protégés :
`22gwgwlhyeeicjzwqqnjyqtl_{deno-cache,rustfs-data,supabase-db-config,supabase-db-data}`
et `bfcflebagytttbgtvox9iby5_{deno-cache,supabase-db-config,supabase-db-data}`.
Ils appartiennent à d'anciennes stacks Supabase. Aucun volume prune.
Aucune image dangling ni reste de build applicatif arrêté observé.
Le conteneur Sentinel arrêté au début était une infrastructure Coolify ; il est reparti.

## Propositions : aucune autre suppression autorisée

Chaque commande destructive attend un oui explicite et doit être précédée
d'un inventaire actualisé, sans déploiement en cours. Les identifiants historiques
ci-dessous ne constituent pas une autorisation future.

Premier candidat à soumettre séparément : ancienne image applicative
`ff9198f37a57`, créée le 14 octobre à 13:28:13 UTC, 3,28 Go logiques.
Elle était sans conteneur attaché au premier relevé et reste présente à 23:09 UTC.
Gain indicatif : environ 1,5 Go de couches propres, à remesurer avant approbation.

```sh
sudo docker image rm sha256:ff9198f37a571eb13257c80fb16ba3d551d2bab797ea8a5f4a6c386b306fb070
```

Effet : perte du rollback local vers cette version ; reconstruction du commit
possible. Ne pas utiliser --force. Vérifier à nouveau les conteneurs arrêtés,
la queue de déploiement et les images conservées avant toute exécution.
Au relevé initial de 17:35 UTC, treize images applicatives dépassaient deux heures ; quatre étaient
protégées par les trois plus récentes, leur âge ou le conteneur actif.
Leurs tailles propres cumulées suggèrent environ 19 Go potentiels, sans garantie
sur l'espace réel rendu à df et sans supposer que toutes peuvent être supprimées.
Ce lot initial est obsolète : plusieurs images ont disparu depuis. Refaire la
simulation sur les sept images restantes avant de proposer une suppression groupée.

Pour un nettoyage faible gain des journaux archivés, proposition distincte :

```sh
sudo journalctl --vacuum-size=200M --vacuum-time=7d
```

Gain immédiat probablement nul avec le plafond déjà en place. Les journaux
effacés sont irréversibles sans export ; ne pas confondre journald avec les logs
techniques Supabase en base ou le journal de suppression de comptes.

## Risque accepté pendant la bêta

Décision explicite de Walid : aucune destination de sauvegarde hors serveur
n'est prévue pour l'instant. Les sauvegardes restent uniquement sur le VPS.
La perte du disque ou du serveur peut donc entraîner la perte de la base active,
de toutes les sauvegardes locales et du journal local de suppression de comptes.
Une copie chiffrée hors serveur, avec restauration d'essai réussie, doit être
mise en place avant le lancement public. Cette condition de lancement ne bloque
pas la proposition de purge locale pendant la bêta.

Cette décision remplace, pour la bêta uniquement, la rétention du
[runbook général](restauration-et-suppression.md) : pas de copie hebdomadaire
supplémentaire exigée ici, au plus sept sauvegardes quotidiennes sur quatorze jours.
Le changement de politique est documenté ; aucune purge n'est encore autorisée
par la seule existence de cette PR.

## Sauvegardes : proposition de sélection et protections

Périmètre initial explicite : uniquement la série des dumps quotidiens complets
de la base applicative, dans ce répertoire précis :

```text
/data/coolify/backups/databases/root-team-0/supabase-yokkai-supabase-db-gawq4yyxiise96wens0dt1ex
```

Accepter seulement les fichiers réguliers dont le nom correspond entièrement
à `pg-dump-postgres-[0-9]+.dmp`, sans récursion et sans suivre de lien symbolique.
L'horodatage du nom donne la date de création en UTC ; un changement de mtime
lors d'une copie ne rajeunit pas le dump. Refuser les dates futures incohérentes.

Règle proposée : garder la sauvegarde la plus récente dans tous les cas.
Parmi les autres, garder au plus un dump par jour UTC, le plus récent de ce jour,
dans les quatorze derniers jours, jusqu'à sept dumps au total.
Tous les autres fichiers de cette série sont candidats, y compris les doublons
du même jour. Si la sauvegarde la plus récente dépasse quatorze jours, la garder,
signaler une sauvegarde trop ancienne et ne pas sacrifier la dernière copie
pour respecter le délai. L'exception peut donc conserver un dump plus de quatorze jours.

Avant suppression : confirmer que la dernière sauvegarde est complète et lisible,
que les fichiers ne sont pas en cours d'écriture et que le plan n'a pas changé.
Si la dernière est invalide ou si l'état est inconnu, arrêter, préserver les anciennes
et alerter. Cette vérification locale ne requiert aucune copie extérieure.

Simulation en lecture seule du 14 octobre à 23:24 UTC :
16 dumps trouvés, sept conservés (8 au 14 octobre), neuf candidats, soit
285 259 633 octets (285 Mo, 272 Mio) potentiellement récupérables.
Aucun fichier n'a été supprimé. Les deux dumps du 30 septembre comptent séparément.
Cette estimation n'inclut aucune archive de volume ni sauvegarde avant migration.

Sont exclus sans autre décision : dumps ponctuels sous le compte d'exploitation,
archives de volumes, sauvegardes avant migration et toutes les autres séries.
Pour les inclure plus tard, valider séparément leur périmètre et leur dernière
copie à préserver ; ne pas mélanger un dump SQL et une archive physique dans
un classement unique. Aucun `find ... -delete` général.

La sélection n'accède qu'à des fichiers de sauvegarde sur cette liste autorisée :
aucune connexion ou commande SQL de suppression, aucun parcours des volumes,
aucune suppression dans /var/lib/docker ou /var/lib/containerd.
La base active, RustFS, les volumes Docker et tout journal indépendant de suppression
de comptes sont hors périmètre. La table active `account_deletion_log` n'est jamais
touchée. Les fichiers du journal ne correspondent pas au motif autorisé.
Contrôle en lecture seule : le chemin réel est identique au chemin autorisé,
sans lien symbolique, et les seize fichiers du motif sont des fichiers réguliers.
Cette preuve concerne la sélection proposée ; le futur script apply reste à revoir.

Un dump peut lui-même contenir une copie ancienne du journal : sa rotation ne
supprime pas le journal actif ou une copie indépendante.

## Images et déclenchement : proposition à valider

Remplacer la règle « toutes les images inutilisées de plus de sept jours »
par l'union suivante, pour le seul dépôt applicatif :

- **N = 3** images les plus récentes, triées par création ;
- l'image courante et toutes celles utilisées par un conteneur, même arrêté ;
- une image de rollback explicitement désignée par son identifiant immuable,
  correspondant au dernier déploiement sain précédent ;
- toutes les images de moins de deux heures et celles d'un déploiement en attente.

Les ensembles peuvent se recouvrir. N + courante + rollback représente au plus
cinq images hors protections supplémentaires. Un simple compteur Coolify ne
remplace pas l'image de rollback épinglée. Si son identifiant, la queue de
déploiement ou l'état Docker est inconnu, ne rien supprimer.
Pas de rmi forcé, de purge de volume ni de suppression d'images plateforme.
Lister nom, identifiant, création, taille et motif de protection en dry-run ;
revérifier juste avant chaque suppression et arrêter si le plan a changé.

Après chaque démarrage d'un nouveau conteneur applicatif, attendre trois minutes,
puis attendre la fin des helpers et revérifier l'état des anciens conteneurs et
la santé du déploiement. Regrouper les événements en rafale : trois minutes
après le dernier démarrage, une seule exécution, puis nouvelle planification si
un autre événement arrive pendant le nettoyage. Au démarrage de l'écouteur,
effectuer aussi une réconciliation afin de couvrir une coupure de l'écoute.
Ne jamais interpréter un simple événement start comme un déploiement réussi.

Conserver le passage nocturne et son timer ; faire appeler le même nettoyeur
par l'écouteur et le timer. Verrou unique
`/run/yokkai-storage-maintenance.lock`, non bloquant, pour images, cache et sauvegardes.
Sortie en erreur sans suppression si un helper tourne ou si la détection échoue.
Le cache inutilisé garde une cible de 2048 Mo ; son délai de conservation normal
de deux heures est distinct du filtre d'âge des images.

## Commandes proposées, non exécutées et non installées

Les commandes suivantes décrivent l'interface du futur script versionné,
à implémenter/revoir puis installer seulement après accord de Walid et Abdou.
Le chemin est volontairement distinct du script actuel : celui-ci ne comprend
pas ces options et continue à supprimer des fichiers après quatorze jours.
Ne jamais lui passer ces arguments en supposant obtenir une simulation.
Aucun script exécutable ni unité systemd n'est livré par cette PR documentaire.

```sh
# Simulation de la seule série de sauvegardes autorisée.
sudo flock -n /run/yokkai-storage-maintenance.lock \
  python3 /opt/yokkai-ops/storage-maintenance.py --dry-run --scope backups

# Application future : nécessite un oui distinct après revue de la simulation.
sudo flock -n /run/yokkai-storage-maintenance.lock \
  python3 /opt/yokkai-ops/storage-maintenance.py --apply --scope backups

# Simulation des images : identifiant de rollback à renseigner avant validation.
sudo flock -n /run/yokkai-storage-maintenance.lock \
  python3 /opt/yokkai-ops/storage-maintenance.py --dry-run --scope images \
  --keep-last 3 --min-image-age 2h --rollback-image "$ROLLBACK_IMAGE_ID"
```

Sans option, le futur script doit rester en dry-run. Les sous-commandes du
nettoyeur ne reprennent pas le verrou déjà détenu par l'appelant.
En service, stdout/stderr vont à journald avec le tag `yokkai-storage`,
rotation assurée par les limites journald existantes. Journaliser mode, début/fin,
candidats, éléments protégés, suppressions confirmées et échecs ; mesurer df avant/après.
Une simulation annonce des octets candidats, jamais de l'espace « libéré ».
En manuel, conserver le code de sortie avec `set -o pipefail` si une sortie
est transmise à `systemd-cat -t yokkai-storage`. Aucun secret dans les messages.

La bascule proposée doit retirer de l'ancien script ses règles d'images et de
sauvegardes remplacées, conserver son timer et employer le verrou commun.
Ne pas juxtaposer ancien find et nouveau sélecteur, ni activer deux nettoyeurs.
En cas de changement inattendu des fichiers, interrompre avant toute suppression.

Lecture du journal et des déclencheurs, sans nettoyage :

```sh
sudo journalctl -t yokkai-storage --since today --no-pager
systemctl list-timers --all --no-pager
systemctl cat yokkai-storage-maintenance.service yokkai-storage-maintenance.timer
df -h /
```

## Coolify : capacités vérifiées et activation proposée

Vérification en lecture seule du code de Coolify 4.3.23 installé, le 14 octobre
à 23:24 UTC. Aucune lecture de sa base, aucune utilisation de clé API admin,
aucune ouverture ou modification de réglage dans son interface.
Les valeurs actuellement enregistrées restent donc à confirmer par Walid/Abdou.

Coolify sait lancer un nettoyage à fréquence donnée et/ou au-dessus d'un seuil.
Dans **Servers > serveur > Docker Cleanup**, les choix à examiner seraient :
`Cleanup frequency = 0 0 * * *`, `Cleanup trigger = Only above disk threshold`,
`Disk threshold = 80`, `Unused volumes = Keep unused volumes`,
`Unused networks = Keep unused networks`,
`Application images = Keep retained images`. Dans **Application > Rollback**,
régler **Images to keep = 3** pour la conservation native.
Ce sont des valeurs proposées, pas une instruction d'activer ce nettoyeur maintenant.

Limite déterminante du code installé : nettoyage dangling sans filtre d'âge,
`docker builder prune -af`, purge buildx sans délai et retrait forcé d'anciennes
images utilitaires. La rétention applicative native garde un nombre d'images
et essaie d'identifier la courante ; elle ne garantit pas un rollback épinglé.
Elle ne couvre donc pas la politique ci-dessus. Les déclenchements natifs après
opérations sur les ressources ne garantissent pas un passage après chaque
déploiement réussi. Garder un seul mécanisme maîtrisé : ne pas activer la purge
native en parallèle de l'extension du timer sans revue de ces écarts.
Références : [nettoyage natif](https://coolify.io/docs/core/infrastructure/servers/automated-docker-cleanup)
et [champs API](https://coolify.io/docs/api/endpoints/servers/update-server-docker-cleanup).

Pour les alertes, privilégier **Discord**, sur un canal d'exploitation restreint :
**Notifications > Discord**, activer le canal et l'événement **Disk usage warning**,
puis **Servers > serveur > Advanced** :
**Notification threshold = 80** et contrôle toutes les quinze minutes
(`*/15 * * * *`, syntaxe cron confirmée dans le validateur installé).
Tester le canal avec **Send test** après accord : cela envoie réellement un message.
Le webhook reste uniquement dans le stockage sécurisé de Coolify, jamais dans Git.

Le code installé expose un seuil de notification par serveur, pas deux niveaux
80/90 distincts. Conserver le warning natif à 80 % ; prévoir à 90 % une notification
critique depuis le même futur contrôle de maintenance, via un fichier de webhook
hors dépôt en permissions 600, sans deuxième script de purge. Dédupliquer à un
message par heure et par niveau ; réarmer après baisse sous 75 %/85 %.
La livraison Discord à 80 ou 90 % doit fonctionner même si le nettoyeur refuse
de supprimer pendant un déploiement. Ne pas limiter les contrôles à la nuit.
La documentation actuelle mentionne un intervalle de répétition réglable :
vérifier sa présence dans cette version avant de compter dessus.
Référence : [événements de notification](https://coolify.io/docs/core/notifications/events).

La rotation Docker 10 Mo × 3 et les limites journald existantes sont conservées,
sans redémarrage Docker proposé. Ne pas transformer une simulation en envoi
de notification ou en mise à jour de Coolify.

## Estimation de croissance et dimensionnement

Les inventaires successifs montrent au moins seize images construites le
14 octobre UTC ; les images retirées entre les relevés rendent ce compte
incomplet. C'est un indicateur de builds, pas un compte certifié de déploiements
réussis. Les builds échoués peuvent aussi créer du cache. Pour mesurer précisément
les déploiements/jour, relever les exécutions Coolify et leur statut sur sept jours,
sans utiliser le nombre de commits comme équivalent.

Hypothèse de planification : 16 builds/jour, images de 2,04 à 3,28 Go.
Volume brut d'images créé : **32,6 à 52,5 Go/jour**. Le cache est un stock qui
monte ou descend, pas 2 Go à additionner indéfiniment chaque jour.
Pour une journée avec reconstitution des 5,22 Go purgés, l'enveloppe brute devient
**37,9 à 57,7 Go/jour**, avant réutilisation des couches et nettoyage.

Le dernier docker system df détaillé attribuait environ 1,51 Go propres à une image
habituelle de 3,28 Go ; 16 images de ce type suggèrent environ 24,2 Go/jour
de couches propres, plus la croissance du cache (jusqu'à environ 29,4 Go sur
l'hypothèse précédente). Ce n'est pas une mesure nette de df : blobs compressés,
snapshots, couches partagées, versions de dépendances et suppressions changent
l'empreinte physique. Les deux calculs sont des scénarios, pas des gains garantis.

Sur les 74 Gio actuels, 15 Gio libres ont été observés après les interventions.
Sans nettoyage, cette marge ne couvre pas une journée active de builds.
La conservation par nombre change le stock : trois dernières + courante + rollback
représentent au plus cinq images, soit 10,2 à 16,4 Go logiques hors protections
d'âge et déploiements en attente. Une rafale pendant deux heures peut protéger
bien plus de cinq images : aucun plafond dur ne doit effacer ces protections.

**Conclusion :** 74 Gio peuvent suffire temporairement à la bêta si le nettoyage
ciblé est validé, testé après déploiement, et si 10 à 15 Gio restent réservés
aux builds et à PostgreSQL. La politique actuelle de sept jours ne suffit pas.
Pour une marge durable, surtout avant ouverture publique, prévoir au moins
120 Gio (160 Gio si le catalogue doit continuer à croître) ou réduire fortement
les images et déplacer les builds. Agrandir ne remplace ni nettoyage ni sauvegarde.
C'est une recommandation de capacité, pas un changement appliqué ni une garantie
sur la croissance des données joueurs/catalogue.

Temporaires : garder systemd-tmpfiles existant ; leur taille mesurée est négligeable.

## Arrêt et réparation

Si df manque d'espace, alerter immédiatement. Si un helper tourne, que les candidates
changent, qu'une base échoue ou qu'un volume semble concerné, arrêter les suppressions.
Ne jamais supprimer directement dans /var/lib/docker ou /var/lib/containerd.
Ne jamais modifier Supabase, Traefik, Coolify ou les sauvegardes pour contourner un blocage.

Cette PR est documentaire : elle n'installe ni ne déclenche aucun automatisme.
Toute modification ou suspension du timer existant doit être coordonnée et approuvée.
Pour diagnostiquer un nettoyage, lire systemctl cat et journalctl -u du service ;
ne pas exécuter le service complet actuel à titre de test.
Un cache supprimé se régénère ; une image retirée se reconstruit ; un journal
ou une sauvegarde supprimé ne se reconstitue pas sans copie.
