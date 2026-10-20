# Fil des murs d'amis sur Home

Fil chronologique en lecture seule des publications existantes de ses amis
acceptés, quel que soit le sens de la demande. Les profils publics non amis et
les demandes en attente n'y apparaissent pas. Les publications restent sur le
mur de leur auteur ; les liens ouvrent directement l'onglet Wall.

Le RPC `get_friend_wall_feed(timestamptz, uuid, integer)` utilise exclusivement
`auth.uid()` et conserve `can_read_profile_wall`, les blocages bilatéraux,
les barrières de suppression et l'exclusion des comptes bannis. Pages de 10
publications, plafond serveur 20, curseur stable `(created_at,id)` décroissant.
Les chemins de stockage ne sont pas exposés : les images utilisent toujours
`/api/profile-wall/media/<post-id>` et ses contrôles RLS sans service-role.

Actualisation au retour sur l'onglet et lors d'un blocage local. Une erreur
retire les données affichées avant de proposer une nouvelle lecture. Les médias
sont chargés à la demande. Aucun like, commentaire ou republication fictif.

## Migrations / publication

- `20261020230000_home_friend_feed.sql` : nouvelle lecture bornée uniquement.
- Appliquée uniquement au Supabase local (`supabase_db_Kara`, port 54322).
- Non appliquée en production ; validation ACL par Walid requise avant déploiement.
- Développement local au-dessus de l'essai Inter (PR #413), sans fusion de ce lot.
- Aperçu : `/design-system/home-preview` (échantillons, pagination, vide, erreur).
