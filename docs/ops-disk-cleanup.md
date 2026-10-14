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
| Partiel                    | Purge des fichiers de sauvegarde Coolify après 14 jours, sans preuve de copie extérieure ; incompatible avec les conditions actuelles de Walid.                  |
| Non présent dans ce script | Verrou flock, simulation, protection des dernières images par nombre, contrôle des déploiements, mesure avant/après et fréquence de plusieurs passages par jour. |
| À vérifier                 | Valeurs et historiques du nettoyage Coolify, copie de secours récente et valide, responsabilité des changements hors Git.                                        |

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

| Catégorie                        | Mesure                                                                  | Traitement                                                  |
| -------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------- |
| Images et snapshots containerd   | Environ 40 Gio physiques                                                | À valider : images applicatives ciblées uniquement.         |
| Stockage RustFS Supabase         | 12,02 Go logiques Docker avant purge                                    | Ne pas toucher.                                             |
| Cache Railpack                   | 7,25 Go avant ; 2,03 Go après                                           | Cache inutilisé seulement ; reconstruit lors des builds.    |
| Volume PostgreSQL Supabase       | 2,827 Go logiques Docker                                                | Ne pas toucher.                                             |
| Bases PostgreSQL                 | `_supabase` 2,221 Go ; `postgres` 506 Mo                                | Mesures par SELECT en transaction READ ONLY, sans écriture. |
| Sauvegardes Coolify              | 1,4 Gio                                                                 | Interdit sans copie extérieure récente et validée.          |
| Autres dumps                     | Environ 483 Mio dans /var/backups, 330 Mo sous le compte d'exploitation | Même protection ; données de joueurs.                       |
| Journaux système                 | Environ 206 Mio ; journald initialement 180 Mio                         | Déjà plafonnés ; faible gain attendu.                       |
| Répertoires de conteneurs Docker | 131 Mio                                                                 | Rotation existante ; aucune suppression directe.            |
| Cache apt                        | 94 Mio                                                                  | À valider, faible intérêt.                                  |
| WAL                              | 80 Mio SQL, environ 81 Mio physiques                                    | Ne jamais supprimer ; pas de problème de taille démontré.   |
| Temporaires                      | /var/tmp 16 Kio ; /tmp 12 Kio, en mémoire                               | Aucun gain significatif.                                    |

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

## Automatisation à décider avec Abdou

Conserver et étendre le timer existant, sans installer un second nettoyeur.
Privilégier les options natives de Coolify après lecture de leur configuration,
mais ne pas les activer si elles ne garantissent pas âge et images conservées.
Montrer Servers > Docker Cleanup et ses Recent executions, Application > Rollback,
Servers > Advanced et Notifications > Discord, en masquant tous les secrets.

Si un petit script reste nécessaire : simulation par défaut, --apply explicite,
verrou unique, refus sur état inconnu ou helper actif, liste des exclusions,
commandes sans force et journal avant/après. Proposition : images applicatives
inutilisées de plus de 24 h, trois dernières et toutes celles de conteneurs ou
déploiements en attente conservées ; réduction exceptionnelle à 2 h seulement
après accord distinct. Cache inutilisé avec cible 2048 Mo, âge normal de 2 h.
Plusieurs passages quotidiens et contrôle de seuil toutes les 15 minutes.
À ce rythme de builds, 24 h de rétention peuvent dépasser la capacité : réduire
les images à la source et mesurer le débit de croissance avant de promettre une marge.

Conserver la rotation Docker actuelle et le plafond journald existant ; aucun
redémarrage Docker nécessaire pour cette proposition. Live-restore est désactivé.
Les fichiers logrotate.d présents ne prouvent pas une rotation exécutée :
logrotate n'a pas été trouvé sur PATH et /etc/logrotate.conf est absent.

Alerte extérieure aux seuils 80 % et 90 %, distincte des messages locaux logger :
préférer Discord Coolify, confirmer que Sentinel et les contrôles de disque tournent.
Un seul seuil natif ne remplace pas automatiquement deux niveaux ; faire valider
le canal et le mécanisme de seconde alerte, sans webhook dans Git.

Sauvegardes : appliquer le [runbook](restauration-et-suppression.md), sept quotidiennes,
quatre hebdomadaires, âge maximum 30 jours en UTC. Avant toute purge, preuve
de copie extérieure chiffrée récente, checksum et restauration validée sur serveur
isolé autorisé ; jamais de dump réel sur un poste personnel.
Le journal de suppression de comptes et sa réplication indépendante sont exclus.
Aucune commande de purge de sauvegardes n'est proposée tant que cette preuve manque.

Temporaires : garder systemd-tmpfiles existant ; inventorier d'abord ownership et âge,
ne pas ajouter de suppression générale dans /tmp ou dans les dossiers de déploiement.

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
