# Réappliquer les suppressions après restauration

Outil administratif manuel uniquement : `scripts/reapply-account-deletions.mjs`.
Il utilise la clé privée `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`),
chargée dans l’environnement serveur, jamais en argument, dans Git ou dans une conversation.
`SUPABASE_URL` désigne l’origine HTTPS du même projet. Aucun secret n’est imprimé.

## Avant la restauration

1. Arrêter le jeu et toutes les écritures (y compris les tâches qui pourraient recréer des données).
2. **Avant d’écraser la base**, exporter le journal courant dans un fichier privé indépendant
   du backup qui va être restauré :

   ```sh
   node scripts/reapply-account-deletions.mjs --export /var/backups/private/deletions-before-restore.json
   ```

   Le fichier est créé sans écrasement, avec permissions `0600` sous Unix. Sous Windows,
   utiliser un dossier dont les ACL n’autorisent que l’administrateur. Le fichier contient
   uniquement les UUID/date du journal, son horodatage d’export et l’origine du projet.
   Les lectures sont paginées ; les écritures doivent rester arrêtées pendant l’export.
   Garder une copie séparée de la base restaurée. **Le journal restauré depuis un ancien
   backup ne contient pas les suppressions survenues depuis ce backup.** En cas de perte
   complète du VPS et sans copie extérieure récente de ce journal, cette procédure ne
   permet pas de garantir leur réapplication : les backups hors VPS restent un chantier distinct.

3. Restaurer le backup, remettre toutes les migrations requises via la procédure de déploiement,
   et maintenir le front ainsi que les tâches d’écriture arrêtés.

## Après la restauration

```sh
node scripts/reapply-account-deletions.mjs --journal /var/backups/private/deletions-before-restore.json
node scripts/reapply-account-deletions.mjs --journal /var/backups/private/deletions-before-restore.json --apply
```

Le premier appel est un **dry-run sans écriture ni appel de suppression**. Il affiche
la cible, le nombre d’entrées et le SHA256 du fichier. Vérifier les UUID/date dans le
fichier privé et sa provenance avant d’autoriser l’opération. Une cible différente,
un UUID/date invalide ou des doublons sont refusés. `--apply` exige un terminal et
la confirmation `REAPPLY <nombre>` ; aucun flag ne la contourne.

La suppression réutilise exactement la routine serveur : clôture/remboursement des
ventes, retrait des mises et prolongation éventuelle, annulation des échanges,
effacement SQL, suppression des avatars via Storage, puis suppression **définitive**
de l’identité par Auth Admin. Une identité déjà absente est acceptée ; les autres
échecs arrêtent la liste au premier UUID, sans nouvelle tentative automatique.
La date originale du journal exporté est conservée (la date la plus ancienne gagne).
Le verrou de suppression reste actif en cas d’échec partiel ; contrôler cet UUID
avant une reprise explicite. Les réexécutions n’effectuent pas deux remboursements.

Avant de rouvrir : vérifier l’absence des identités, profils, collections et avatars
concernés, les références anonymes « Joueur supprimé », le journal, puis lancer
`check-prod-drift.sh`. Le script ne restaure rien, n’applique aucune migration,
ne réactive aucun service et n’est jamais exécuté automatiquement.
