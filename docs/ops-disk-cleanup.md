# Exploitation du nettoyage du disque

## �tat de l�intervention

PR #242 : extension du script `yokkai-storage-maintenance` d�Abdou, pas de
second m�canisme de purge. Coordination confirm�e par Walid. Installation et
premier passage r�el encore en attente de CI GitHub verte et de la revue finale.
Aucune migration Supabase ; aucune modification de donn�es applicatives.

�tat de r�f�rence du 14 octobre 2026 � 23:38 UTC : disque 74 Gio, 57 Gio utilis�s,
15 Gio disponibles, 80 %. Docker : 29 images / 26,41 Go logiques, 22 conteneurs
actifs, 14 volumes / 22,29 Go (prot�g�s), cache du builder par d�faut nul.
Le cache Railpack est distinct et se mesure dans son conteneur BuildKit.
Sauvegardes Coolify : 1,4 Gio ; `/var/backups` : 561 Mio, hors purge.
Les trois pages publiques et internes r�pondent en 200 avant installation.

## Risque accept� pendant la b�ta

Walid accepte temporairement des sauvegardes uniquement sur le serveur : une
perte du disque peut perdre simultan�ment les donn�es joueurs et leurs copies.
Aucune copie externe n�est exig�e pour cette r�tention locale. Avant lancement
public : mettre en place une copie chiffr�e hors serveur et une restauration d�essai.
Une archive lisible par pg_restore ne remplace pas ce test de restauration.

## Ce que chaque r�gle supprime et prot�ge

| Cat�gorie                | Suppression autoris�e                                                                                                              | Protections                                                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Images application       | Identifiant du seul d�p�t `lbugcql3gc8ijtbv7qqy70do`, sans force                                                                   | Trois derni�res, courante, rollback �pingl�, toute image r�f�renc�e par un conteneur m�me arr�t�, �ge inf�rieur � deux heures |
| Cache Railpack           | `buildctl prune --keep-duration 2h --keep-storage 2048 --all` limit� aux identifiants inventori�s via des filtres `id==�`          | Builder actif contr�l�, r�f�rences en usage prot�g�es par BuildKit, fichiers r�cents prot�g�s ; aucun retrait du volume       |
| Restes de build          | Conteneur arr�t� depuis construction de plus de deux heures, image du d�p�t et �tiquette explicite `yokkai.cleanup.role=app-build` | Tous les autres conteneurs ; aucun �tiquetage automatique d�un ancien conteneur                                               |
| Sauvegardes quotidiennes | Anciennes copies et doublons au-del� de sept jours UTC distincts conserv�s, ou �g�es de plus de quatorze jours                     | Derni�re sauvegarde toujours conserv�e m�me ancienne ; autres s�ries, bases actives et journaux hors p�rim�tre                |

La limite de cache est un objectif souple : les protections d��ge et d�usage
peuvent emp�cher de descendre � 2 048 Mo. La taille logique des images ne pr�dit
pas l�espace r�cup�r� : couches partag�es. Seul df avant/apr�s mesure le gain disque.
Les images Supabase/Coolify, images sans �tiquette, r�seaux et volumes ne sont
jamais des candidats. L�ancienne purge globale de sept jours est remplac�e.

La seule s�rie de fichiers admise est le dossier suivant, sans r�cursion :

```text
/data/coolify/backups/databases/root-team-0/supabase-yokkai-supabase-db-gawq4yyxiise96wens0dt1ex
```

Seuls les noms complets `pg-dump-postgres-<timestamp>.dmp` sont admis. Date UTC
issue du nom, fichiers r�guliers sans lien, chemin canonique. La plus r�cente
et les candidates sont enti�rement parcourues par `pg_restore --file=/dev/null`
dans le conteneur PostgreSQL, sans connexion � une base et sans afficher le SQL.
Une modification de l�inventaire ou d�un inode interrompt la purge. Les fichiers
r�cents en cours d��criture et archives invalides provoquent un arr�t.
Le journal de suppression de comptes, les dumps avant migration, les archives de
volumes et `/var/backups` ne correspondent jamais � cette liste autoris�e.

## Garde-fous et d�clenchement

Un verrou flock commun `/run/yokkai-storage-maintenance.lock` prot�ge tous les
passages. Simulation par d�faut, suppression seulement avec `--apply`.
La premi�re suppression exige `--expect-plan` avec l�empreinte du dry-run relu.
La simulation �crit uniquement le journal et les m�tadonn�es de protection du
rollback ; elle ne supprime aucune donn�e. �tat root en permissions 600 sous
`/var/lib/yokkai-storage-maintenance/state.json` ; dossier 700.

La file Coolify est lue dans une transaction SQL READ ONLY limit�e aux statuts
et r�f�rences de d�ploiement, avec autorisation explicite de Walid. Aucune cl�
admin ou service_role. Une file non vide, illisible, un helper de d�ploiement,
un conteneur arr�t� inattendu ou malsain, ou un contr�le HTTP en �chec interdit
les suppressions. Nouvelle v�rification juste avant chaque op�ration.
Cette lecture n�est pas un verrou atomique sur Coolify : un d�ploiement peut
commencer entre deux contr�les. Docker refuse de retirer une image r�f�renc�e
(sans force) et BuildKit prot�ge ses r�f�rences actives. Coordonner toute
intervention manuelle ; ne pas activer le nettoyeur natif Coolify en parall�le.

Le rollback est initialis� depuis une image pr�c�demment observ�e en service,
puis avanc� quand une nouvelle version courante passe les contr�les, avant toute
purge. Une exception pendant un passage r�el verrouille l��tat `paused=true` :
les prochains passages r�els refusent de supprimer tant qu�un op�rateur n�a pas
compris et r�par� le probl�me. Les simulations restent disponibles.

Le timer existant conserve sa nuit � 03:30 Europe/Paris et ajoute 00:00, 06:00,
12:00, 18:00 UTC, avec d�lai al�atoire maximal d�une minute. Le service �v�nements
�coute Docker ; apr�s le dernier d�marrage de l�application, il attend trois
minutes, puis appelle le m�me service. Rafales regroup�es ; conflit ou �chec
r�essay� apr�s une minute. Une reconnexion r�concilie les �v�nements manqu�s.

Le journal JSON va dans journald : candidats, motifs de protection, suppressions,
df et docker system df avant/apr�s, erreur d�arr�t. Rotation et plafond existants
conserv�s : journal syst�me 200 Mo, r�tention sept jours ; Docker 10 Mo � 3.
Aucun red�marrage Docker, application, proxy ou base n�est n�cessaire.

## Installation et premi�re ex�cution

Le serveur re�oit uniquement l�archive du commit relu et vert dans GitHub Actions,
sous `/opt/yokkai-ops/revisions/<commit>/`. Ne pas copier une version modifi�e �
la main. La release est root, non modifiable par le compte d�exploitation.
Le script d�installation exige le snapshot pris � l��tape z�ro.

```sh
# Depuis le dossier immuable du commit approuv�, apr�s transfert de git archive :
sudo bash ops/install-storage-maintenance.sh prepare <identifiant-sha256-du-rollback-observe>

# Une seule simulation manuelle. Lire toutes les lignes candidat/protection.
sudo /usr/local/sbin/yokkai-storage-maintenance --dry-run

# Seulement si la liste respecte tous les garde-fous ; autoris� par Walid :
sudo /usr/local/sbin/yokkai-storage-maintenance --apply --expect-plan <empreinte-du-dry-run>

# Apr�s contr�le de sant� r�ussi :
sudo bash ops/install-storage-maintenance.sh activate
```

Avant/apr�s : `df -h /`, `docker system df`, �tat de tous les conteneurs et
HTTP 200 sur `/`, `/connexion`, `/inscription`, publiquement et directement
dans le conteneur. Lire les journaux PostgreSQL r�cents sans erreur nouvelle.
Une variation de candidats n�cessite un nouveau dry-run et une nouvelle revue.
Aucun test n��crit dans la base ni ne cr�e de compte ou de partage.

```sh
sudo journalctl -t yokkai-storage --since today --no-pager
sudo journalctl -u yokkai-storage-maintenance-events --since today --no-pager
systemctl list-timers --all yokkai-storage-maintenance.timer
sudo cat /var/lib/yokkai-storage-maintenance/state.json
```

## D�sactiver et revenir en arri�re

Pour geler les suppressions sans d�sactiver le timer du coll�gue : remettre
`CLEANUP_MODE=--dry-run` dans `/etc/default/yokkai-storage-maintenance` puis
arr�ter seulement `yokkai-storage-maintenance-events.service`. Le service reste
utilisable en simulation ; ne jamais lancer l�ancien script comme diagnostic.

Snapshot v�rifi� du script, des unit�s et des r�glages journald/logrotate :
`/var/backups/yokkai-ops-config/20261014T233834311541Z`, root 700. Manifest des
fichiers pr�sents/absents et SHA256 des fichiers copi�s. Aucun r�glage journald
ou logrotate n�est modifi� par cette installation.

Retour en arri�re des seuls changements install�s : depuis la m�me release,

```sh
sudo bash ops/install-storage-maintenance.sh rollback
```

Cette commande arr�te/d�sactive uniquement le nouveau service �v�nements,
restaure par `cp -a` le script `/usr/local/sbin/yokkai-storage-maintenance` et
les unit�s service/timer depuis `snapshot/files/<chemin>`, recharge systemd puis
r�active le timer nocturne initial. Les autres fichiers de release et l��tat
restent inertes. Elle ne red�marre aucun conteneur. Attention : elle r�tablit
l�ancienne politique de purge globale ; faire relire avant la nuit suivante.
Une suppression d�image exige une reconstruction pour revenir ; un cache se
reconstitue. Une sauvegarde supprim�e sans copie ne peut pas �tre r�cup�r�e.

## Alertes Coolify vers Discord � manipulation par Walid

Dans **Notifications > Discord** : activer Discord et **Disk usage warning**,
coller le webhook directement dans Coolify, s�lectionner un canal d�exploitation
restreint. Ne jamais envoyer l�URL dans le chat ou Git. **Send test** envoie un
vrai message ; Walid le d�clenche lui-m�me.
Dans **Servers > serveur > Advanced** : **Notification threshold = 80**, contr�le
`*/15 * * * *`. V�rifier la r�ception du test et l�intervalle de r�p�tition propos�.

Le code Coolify 4.3.23 install� ne propose qu�un seuil par serveur : deux alertes
natives distinctes 80 % et 90 % ne peuvent pas �tre promises. Garder 80 % ; le
second niveau 90 % reste � d�cider avec Walid/Abdou. Aucun webhook suppl�mentaire
ni r�glage de purge Coolify n�est install�. L�alerte doit rester ind�pendante du
succ�s du nettoyage, notamment pendant un d�ploiement.

Le nettoyeur natif offre un seuil disque et une fr�quence, mais ses purges de
cache/anciennes images ne garantissent pas les m�mes d�lais ni le rollback �pingl�.
Ne pas l�activer en parall�le ; **Unused volumes = Keep unused volumes** doit
rester s�lectionn�, de m�me pour les r�seaux.
Sources : [nettoyage Coolify](https://coolify.io/docs/core/infrastructure/servers/automated-docker-cleanup),
[notifications](https://coolify.io/docs/core/notifications/events),
[BuildKit 0.32.2](https://github.com/moby/buildkit/blob/v0.32.2/cmd/buildctl/prune.go).

## Capacit� et contr�le apr�s 24 heures

Au moins seize images construites le 14 octobre : indicateur incomplet de builds,
pas compte certifi� de d�ploiements r�ussis. Images 2,04�3,28 Go : 32,6�52,5 Go
logiques/jour � seize builds, plus variation du stock de cache. Une image usuelle
avait environ 1,51 Go propres, soit environ 24,2 Go/jour avant purge/r�utilisation.
Avec reconstitution des 5,22 Go de cache pr�c�demment purg�s : enveloppe indicative
jusqu�� 29,4 Go/jour de couches propres + cache, pas une mesure nette de df.

74 Gio peuvent suffire temporairement en b�ta avec nettoyage, en gardant 10�15 Gio
libres pour builds/PostgreSQL. Les rafales de moins de deux heures peuvent prot�ger
plus de cinq images. Walid g�re l�augmentation OVH ; recommander 120�160 Gio pour
une marge durable, sans en faire une garantie ni remplacer la r�duction d�images.
Apr�s 24 h : relever espace libre, suppressions effectives par cat�gorie, passages
refus�s, incidents et sant�. Aucune action destructive dans ce suivi.
