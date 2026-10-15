# Nettoyage du disque — procédure et rapport

## Résultat de l’intervention

**Activation réelle arrêtée par un garde-fou. Aucune commande `--apply` exécutée.**

Le commit `6eb84e90` de la PR #242 a été relu et validé par GitHub Actions
(lint, types, format, tests, build, audit des dépendances et sécurité migrations).
Il a été installé le 14 octobre 2026 à 23:58 UTC, uniquement en simulation.
Coordination avec Abdou confirmée par Walid ; aucun changement Supabase ni migration.

Le rechargement du timer persistant a déclenché un dry-run automatique, terminé
sans suppression à 23:59:57 UTC : trois images candidates, neuf dumps / 285 259 633
octets candidats, aucun conteneur arrêté candidat et aucun volume candidat.
Les trois dernières images, la courante, le rollback et la dernière sauvegarde
étaient explicitement protégés. Une tentative manuelle concomitante a été refusée
par le verrou avant tout travail. La sauvegarde de minuit a ensuite été créée.

Le passage automatique suivant a refusé toute purge à 00:02:18 UTC :

```text
current or rollback image is missing or belongs to another repository
```

Vérification en lecture seule : l’image de rollback `b5c95e5988ee…` a disparu.
Il ne reste que `3b181eec399f…` (courante) et `13d3f5a6cab4…` dans le dépôt de
l’application. La troisième image récente a également disparu.
Les journaux Coolify montrent `App\Jobs\DockerCleanupJob` démarré le 15 octobre
à 00:00:07 UTC et terminé à 00:01:21. Cette tâche native coïncide avec la
suppression de cinq images et un inventaire BuildKit désormais vide (`null`).
Nous n’avons exécuté ni suppression d’image, ni prune de cache, ni purge de dump.

| Mesure                | Avant                                           | Après le nettoyage externe                                  |
| --------------------- | ----------------------------------------------- | ----------------------------------------------------------- |
| df -h /               | 74 Gio ; 57 Gio utilisés ; 15 Gio libres ; 80 % | 74 Gio ; 44 Gio utilisés ; 28 Gio libres ; 62 %             |
| Docker images         | 29 ; 26,41 Go logiques                          | 24 ; 18,84 Go logiques                                      |
| Conteneurs            | 22 actifs                                       | 22 actifs                                                   |
| Volumes, protégés     | 14 ; 22,29 Go de contenu                        | 14 ; 15,72 Go de contenu                                    |
| Série SQL quotidienne | 16 dumps avant minuit                           | 17 dumps ; 585 755 424 octets, nouvelle sauvegarde comprise |

Le gain apparent d’environ 13 Gio n’est pas attribuable à notre script. Les tailles
Docker sont logiques et non additives ; les couches sont partagées. Le contenu
du volume d’état BuildKit peut diminuer après purge interne sans retrait du volume.
Dernier df exact : 79 048 540 160 octets de capacité ; 46 255 951 872 utilisés ;
29 529 219 072 disponibles (62 %).

Tous les conteneurs restent actifs, sains lorsqu’ils disposent d’une sonde.
PostgreSQL accepte les connexions, aucune nouvelle erreur critique détectée ;
accueil, connexion et inscription répondent en 200, publiquement et en interne
avant installation, puis publiquement après le blocage.

État laissé : `CLEANUP_MODE=--dry-run`, service événements inactif ; timer existant
conservé et étendu, mais ses passages restent des simulations. Aucun redémarrage
de Docker, du site ou d’une base. Aucun réglage Coolify/Traefik/Supabase modifié.
Aucune restauration de configuration déclenchée : pas de dégradation du site ;
restaurer l’ancien script réintroduirait sa purge globale.

**Avant reprise :** Walid et Abdou doivent vérifier les réglages de nettoyage
natif dans Coolify et choisir un seul nettoyeur. Ne pas activer notre purge en
parallèle. Retrouver ou reconstruire un rollback identifié et validé ; ne pas
réécrire le pin pour contourner le refus. La permission SQL actuelle ne couvre
que la file de déploiement, pas la lecture des réglages Coolify en base.

## Risque accepté pendant la bêta

Walid accepte temporairement des sauvegardes uniquement sur le serveur : une
perte du disque peut perdre simultanément les données joueurs et leurs copies.
Aucune copie externe n’est exigée pour cette rétention locale. Avant lancement
public : copie chiffrée hors serveur et restauration d’essai obligatoires.
Une archive lisible par pg_restore ne remplace pas un test de restauration.

## Règles du script installé, encore en simulation

| Catégorie          | Cible autorisée                                                                                                          | Ce qui est protégé                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Images application | Identifiant du seul dépôt `lbugcql3gc8ijtbv7qqy70do`, sans force                                                         | Trois dernières, courante, rollback épinglé, toute image référencée par un conteneur même arrêté, âge inférieur à deux heures |
| Cache Railpack     | `buildctl prune --keep-duration 2h --keep-storage 2048 --all`, limité aux IDs inventoriés par filtres `id==…`            | Références en usage et récentes ; jamais le volume lui-même                                                                   |
| Restes de build    | Conteneur arrêté, construction de plus de deux heures, image du dépôt et label explicite `yokkai.cleanup.role=app-build` | Tous les autres conteneurs ; aucun étiquetage automatique                                                                     |
| Dumps quotidiens   | Copies au-delà de sept jours UTC distincts conservés, ou âgées de plus de quatorze jours, doublons compris               | Dernière sauvegarde toujours conservée même ancienne ; autres séries, bases et journaux hors périmètre                        |

La limite du cache est souple : protections d’âge et d’usage prioritaires sur le
plafond de 2 048 Mo. Les images Supabase/Coolify, images sans étiquette, réseaux et
volumes ne sont jamais candidats. L’ancienne purge globale de sept jours est remplacée.

Seul dossier de sauvegardes admis, sans récursion :

```text
/data/coolify/backups/databases/root-team-0/supabase-yokkai-supabase-db-gawq4yyxiise96wens0dt1ex
```

Noms complets `pg-dump-postgres-<timestamp>.dmp`, date UTC issue du nom, fichiers
réguliers sans liens, chemin canonique. Dernière archive et candidates parcourues
en flux par `pg_restore --file=/dev/null`, sans connexion à une base ni affichage
SQL. Inventaire ou inode modifié : arrêt. Archive invalide, trop petite ou dont
la modification date de moins de dix minutes : arrêt. Le journal de suppression
de comptes, les dumps ponctuels, archives physiques et `/var/backups` sont exclus.

Verrou flock commun `/run/yokkai-storage-maintenance.lock`. Simulation par défaut ;
suppression seulement avec `--apply`. Première apply avec `--expect-plan` et
empreinte du dry-run relu. La simulation écrit uniquement journal et métadonnées
de rollback. État root 600 sous `/var/lib/yokkai-storage-maintenance/state.json`,
dossier 700. Avant suppression, marqueur `in_progress=true` synchronisé sur disque ;
succès et santé finale seuls le lèvent. Une exception pose aussi `paused=true`.
Après interruption, un opérateur doit comprendre/réparer avant toute nouvelle purge.

File Coolify lue dans une transaction SQL READ ONLY limitée aux statuts et
références autorisés par Walid, sans clé admin/service_role. File non vide ou
illisible, helper actif, conteneur inattendu arrêté/malsain, HTTP en échec : refus.
Contrôle juste avant chaque opération. Cette lecture n’est pas un verrou atomique
sur Coolify : un déploiement peut commencer entre contrôles. Docker sans force
refuse une image référencée et BuildKit protège les références actives.
Le rollback observé sain est enregistré avant toute purge, indépendamment de son succès.

Timer : nuit conservée à 03:30 Europe/Paris et passages 00:00, 06:00, 12:00,
18:00 UTC, délai aléatoire maximal d’une minute. Service événements préparé mais
inactif : attendre trois minutes après le dernier démarrage applicatif, regrouper
les rafales, appeler le même service ; conflit/échec réessayé après une minute.
Journal JSON dans journald : protections, candidats, suppressions, df et Docker
avant/après. Plafonds existants conservés : journald 200 Mo / sept jours ; Docker
10 Mo × 3. Aucun redémarrage Docker nécessaire.

## Commandes de reprise — ne pas exécuter avant résolution du conflit

Le serveur reçoit seulement une archive Git du commit relu et vert, dans
`/opt/yokkai-ops/revisions/<commit>/`. La release installée reste `6eb84e90`.

```sh
# Installation initiale, déjà faite ; ne pas réinitialiser un état existant :
sudo bash ops/install-storage-maintenance.sh prepare <sha256-du-rollback-observe>

# Après résolution du conflit et validation du rollback :
sudo /usr/local/sbin/yokkai-storage-maintenance --dry-run
sudo /usr/local/sbin/yokkai-storage-maintenance --apply --expect-plan <empreinte-relue>

# Seulement après santé et première apply réussies :
sudo bash ops/install-storage-maintenance.sh activate
```

Ne pas lancer l’ancien script comme diagnostic. Avant/après : df, Docker,
conteneurs, PostgreSQL et HTTP 200 sur les trois pages. Aucun compte ni partage créé.

```sh
sudo journalctl -t yokkai-storage --since today --no-pager
sudo journalctl -u yokkai-storage-maintenance-events --since today --no-pager
systemctl list-timers --all yokkai-storage-maintenance.timer
sudo cat /var/lib/yokkai-storage-maintenance/state.json
```

## Désactivation et retour arrière

Pour geler les suppressions sans désactiver le timer du collègue : conserver
`CLEANUP_MODE=--dry-run` dans `/etc/default/yokkai-storage-maintenance` et le
service événements arrêté. C’est déjà l’état actuel.

Snapshot vérifié : `/var/backups/yokkai-ops-config/20261014T233834311541Z`, root 700,
manifest des fichiers présents/absents et empreintes SHA256 des copies. Script,
service, timer, journald et logrotate copiés. Journald/logrotate non modifiés.
Depuis la release installée, retour arrière disponible :

```sh
sudo bash ops/install-storage-maintenance.sh rollback
```

Arrête/désactive seulement le nouveau service événements ; restaure par `cp -a`
le script et les deux unités depuis `snapshot/files/<chemin>` ; recharge systemd
et réactive le timer nocturne initial. Les autres fichiers restent inertes.
Aucun conteneur redémarré. Attention : l’ancienne purge globale est rétablie.
Un cache se reconstitue, une image exige reconstruction ; un dump supprimé sans
copie ne peut pas être récupéré. Le retour de configuration n’annule pas une suppression.

## Alertes Discord — action manuelle de Walid

Dans **Notifications > Discord** : activer Discord, coller le webhook directement
au champ **Webhook URL**, enregistrer ; dans les événements **Servers**, activer
**Disk usage warning**. Choisir un canal d’exploitation restreint. **Send test**
envoie un vrai message : Walid le déclenche lui-même. Jamais d’URL dans le chat/Git.
Dans **Servers > serveur > Advanced > Disk usage** : **Notification threshold = 80**,
**Check frequency = */15 * * * *** ; enregistrer et vérifier la réception.

Coolify 4.3.23 installé n’expose qu’un seuil par serveur. Deux niveaux natifs
80/90 ne sont pas possibles simultanément : conserver 80 ; le niveau 90 reste
à décider avec Walid/Abdou. Aucun webhook supplémentaire ni réglage modifié ici.
L’alerte doit fonctionner même pendant un déploiement ou un refus du nettoyeur.
Le nettoyage Docker natif ne garantit pas nos protections d’âge/rollback ; ne pas
le cumuler avec notre mécanisme. Les volumes/réseaux inutilisés doivent rester conservés.
Sources : [nettoyage Coolify](https://coolify.io/docs/core/infrastructure/servers/automated-docker-cleanup),
[notifications](https://coolify.io/docs/core/notifications/events),
[BuildKit 0.32.2](https://github.com/moby/buildkit/blob/v0.32.2/cmd/buildctl/prune.go).

## Capacité et suivi

Au moins seize images construites le 14 octobre : compte incomplet de builds,
pas de déploiements réussis. À 2,04–3,28 Go/image : 32,6–52,5 Go logiques/jour,
plus variation du cache. Une image usuelle avait environ 1,51 Go propres :
24,2 Go/jour avant purge/réutilisation, jusqu’à 29,4 Go en ajoutant la
reconstitution des 5,22 Go de cache auparavant purgés. Scénarios, pas gain net de df.
74 Gio peuvent suffire temporairement en bêta si 10–15 Gio restent libres ;
rafales de moins de deux heures prioritaires sur le plafond d’images. Recommander
120–160 Gio pour une marge durable ; agrandissement OVH réservé à Walid.
Le suivi à 24 h reste exclusivement en lecture seule : espace, suppressions/refus,
santé et incidents. Il ne doit jamais relancer automatiquement cette activation bloquée.

## Révision du garde-fou — reprise du 15 octobre

Cette révision remplace le contrôle global de santé décrit plus haut. Installation
et activation de cette révision encore en attente de revue/CI et des réglages que
Walid réalise dans l’interface. Le nettoyage natif doit être désactivé, pas le timer
existant d’Abdou. Le canal Discord de l’équipe propriétaire doit être configuré.

Garde ciblé : application active, PostgreSQL, envoy, proxy public, auth et REST
obligatoirement en cours d’exécution. Une ancienne application arrêtée ne bloque
pas si une courante unique existe ; son image reste protégée par sa référence.
Les conteneurs non critiques arrêtés, les tâches terminées (y compris exited 0),
leurs sondes transitoires et l’absence de sonde ne bloquent pas. Une sonde unhealthy
seule ne suffit pas à bloquer un conteneur running ; HTTP public/interne et
pg_isready restent obligatoires. Un critique arrêté, absent ou en pause bloque.

Queue Coolify non vide, helper running ou références BuildKit `inUse` : attente.
Le conteneur BuildKit simplement running n’est pas un build actif. Démarrage d’un
critique : attente aussi. Premier essai plus trois retries de 60 secondes, puis
STOP avec noms, états, santé, exit code et références de build concernés. Aucun
retrait pendant ces attentes. Une file illisible ne devient jamais une file vide.

Le verrou occupé produit SKIP, pas STOP ; aucun second nettoyeur ne s’exécute.
Après deux exécutions finies en STOP : alerte Discord avec noms et raison, via le
webhook déjà stocké dans Coolify, lu et utilisé exclusivement dans son conteneur.
Ni URL, ni clé n’est transmise à l’hôte ou au dépôt. Une alerte par série d’échecs,
nouvelle tentative au prochain STOP si envoi impossible ; succès réarme le compteur.
L’absence de canal produit un journal explicite et interdit l’activation complète.
Le compteur durable reste privé dans `runs.json`, à côté de l’état de rollback.

`upgrade` conserve cet état et installe en dry-run ; le timer n’est rechargé qu’à
l’activation après apply réussie. L’activation redémarre le watcher pour charger
le nouveau code. Toutes les règles de suppression, d’âge, de backup et de pin
restent inchangées. Aucune réinitialisation artificielle de rollback.

### Inventaire avant correction

Le relevé contient 23 conteneurs, tous running et aucun paused/exited. Le conteneur
supplémentaire `4nxumgfhmmjzcpmgy2hxbkes` avait disparu au contrôle suivant.
BuildKit avait alors des références `inUse` : un build réel était en cours.
Aucun conteneur normalement arrêté n’a été observé dans ce relevé.

| Nom                                              | État                               | Santé      |
| ------------------------------------------------ | ---------------------------------- | ---------- |
| coolify-sentinel                                 | running                            | healthy    |
| 4nxumgfhmmjzcpmgy2hxbkes                         | running au relevé, disparu ensuite | sans sonde |
| lbugcql3gc8ijtbv7qqy70do-001410284090            | running                            | sans sonde |
| supabase-envoy-gawq4yyxiise96wens0dt1ex          | running                            | healthy    |
| supabase-edge-functions-gawq4yyxiise96wens0dt1ex | running                            | healthy    |
| supabase-storage-gawq4yyxiise96wens0dt1ex        | running                            | healthy    |
| supabase-studio-gawq4yyxiise96wens0dt1ex         | running                            | healthy    |
| supabase-supavisor-gawq4yyxiise96wens0dt1ex      | running                            | healthy    |
| supabase-meta-gawq4yyxiise96wens0dt1ex           | running                            | healthy    |
| realtime-dev-gawq4yyxiise96wens0dt1ex            | running                            | healthy    |
| supabase-auth-gawq4yyxiise96wens0dt1ex           | running                            | healthy    |
| supabase-rest-gawq4yyxiise96wens0dt1ex           | running                            | sans sonde |
| supabase-analytics-gawq4yyxiise96wens0dt1ex      | running                            | healthy    |
| supabase-db-gawq4yyxiise96wens0dt1ex             | running                            | healthy    |
| supabase-vector-gawq4yyxiise96wens0dt1ex         | running                            | healthy    |
| supabase-rustfs-gawq4yyxiise96wens0dt1ex         | running                            | healthy    |
| imgproxy-gawq4yyxiise96wens0dt1ex                | running                            | healthy    |
| buildx_buildkit_coolify-railpack0                | running                            | sans sonde |
| coolify-proxy                                    | running                            | healthy    |
| coolify                                          | running                            | healthy    |
| coolify-db                                       | running                            | healthy    |
| coolify-redis                                    | running                            | healthy    |
| coolify-realtime                                 | running                            | healthy    |
