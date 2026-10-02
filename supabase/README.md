# Supabase — v0.2

## Configuration Next.js

Copier `.env.example` vers `.env.local` et renseigner l'URL et la clé publique
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. `.env.local` est ignoré par Git.

Les clients sont dans `utils/supabase/client.ts` et `utils/supabase/server.ts`.
Le client serveur reçoit `await cookies()` en argument. Le fichier racine
`proxy.ts` appelle `updateSession()` avant le rendu, via `auth.getClaims()`.
Il utilise la convention Proxy de Next.js 16.

## Migrations du schéma

1. `migrations/20260923000000_create_card_schema.sql` : trois tables, enum,
   contraintes, index, droits et règles RLS.
2. `migrations/20260923000001_create_signup_profile.sql` : création du profil
   à l'inscription à partir de `options.data.pseudo`.
3. `migrations/20260923000002_regular_pack.sql` : informations du jeu, statut
   des packs et ouverture transactionnelle du Regular Pack.

Ces fichiers ne sont pas appliqués automatiquement au projet distant.
Exécuter leur contenu dans cet ordre dans le SQL Editor de Supabase, ou via
la CLI Supabase une fois le projet initialisé et lié. Ne pas rejouer une
migration déjà appliquée.

Le 24 septembre 2026, les trois migrations ont été appliquées au projet distant
dans une transaction via l'API d'administration, avec leurs versions exactes
enregistrées dans `supabase_migrations.schema_migrations`. Les trois tables,
les protections RLS, l'interdiction des écritures directes des joueurs et les
droits d'exécution des RPC ont été vérifiés. Le script d'import n'exécute
toujours aucune migration lui-même.

Le schéma conserve exactement les colonnes demandées. Les dates utilisent
`timestamptz` pour représenter un instant indépendamment du fuseau du joueur.
Le couple `(source, source_id)` est unique pour permettre un import relançable.
Les doublons sont permis dans `user_cards`, chacun avec son propre UUID.
Supprimer un compte supprime son profil et ses exemplaires ; une carte possédée
ne peut pas être supprimée du catalogue.

Le catalogue est lisible publiquement. Un joueur connecté ne lit que son profil
et ses exemplaires. Aucune écriture directe n'est accordée au navigateur :
l'import utilise des droits serveur et l'ouverture d'un pack passe par la
fonction transactionnelle de la troisième migration.

Le trigger exige un pseudo non vide à chaque nouvelle inscription. Les comptes
déjà présents dans Auth ne sont pas modifiés ; un éventuel profil manquant devra
être créé avec un pseudo choisi avant de jouer. Les pseudos ne sont pas uniques,
aucune exigence d'unicité n'ayant été spécifiée.

## Timer et accumulation des packs

Le stock de Regular Packs est plafonné à cinq avec le seul champ de planification,
`next_regular_pack_at` représente la disponibilité du plus ancien pack non
consommé. Sa valeur initiale est antidatée de quatre intervalles, soit cinq packs
immédiatement disponibles pour chaque nouveau compte.
La fonction serveur utilise l'heure de la DB, sous verrou du profil :

```text
intervalle = 15 minutes
disponibles = clamp(1 + floor((maintenant - échéance) / intervalle), 0, 5)
après ouverture = max(échéance, maintenant - 4 × intervalle) + intervalle
```

La date du prochain pack à afficher est calculée à partir de cette échéance et
du nombre de packs disponibles ; elle vaut `null` quand les cinq packs sont
disponibles. Le timer, les insertions et le tirage sont dans une même
transaction. Les exemplaires portent leur rareté effective et les marqueurs
`is_shiny` et `is_evolved`; la monnaie n'est pas encore ajoutée.

## Références

- [Clients SSR et rafraîchissement de session](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Droits et Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Profils liés à Auth](https://supabase.com/docs/guides/auth/managing-user-data)

## Import du catalogue — étape 2

Le script `scripts/import-cards.mjs` utilise Node.js 22.9+ et les dépendances
du projet (`npm install`). Le CSV nettoyé présent ici est
`data/characters_clean.csv`, produit par `data/clean_and_assign_rarity.py`.

Après application des deux migrations, ajouter dans `.env.local` une
`SUPABASE_SECRET_KEY` ou, pour les anciennes clés, une
`SUPABASE_SERVICE_ROLE_KEY`. L'URL vient de `NEXT_PUBLIC_SUPABASE_URL`.
La clé publique existante `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` convient
à l'application, mais ne donne pas les droits nécessaires pour importer.
La clé serveur ne doit jamais porter le préfixe `NEXT_PUBLIC_`.
Voir [les types de clés Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Depuis la racine du projet (commandes compatibles PowerShell) :

```powershell
# Validation complète du CSV, sans réseau ni écriture dans Supabase
node --env-file-if-exists=.env.local scripts/import-cards.mjs --dry-run --batch-size 1000

# Petit import réel pour vérifier la configuration
node --env-file-if-exists=.env.local scripts/import-cards.mjs --limit 10

# Import complet
npm run import:cards

# Réglages optionnels
node --env-file-if-exists=.env.local scripts/import-cards.mjs --csv data/characters_clean.csv --batch-size 100 --concurrency 5 --bucket card-images
```

Le script vérifie les colonnes du catalogue puis crée le bucket public
`card-images` s'il n'existe pas, via l'API Storage. Aucune policy d'écriture
pour les utilisateurs n'est ajoutée. Un bucket existant privé provoque un
arrêt explicite ; sa visibilité n'est pas modifiée automatiquement.

Le CSV est lu en flux, par lots de 100 lignes et 5 téléchargements simultanés
par défaut. Les raretés sont reprises telles quelles, y compris `LR`, sans
recalcul. Les valeurs facultatives vides deviennent `null` ; une franchise
inconnue reste une chaîne vide comme dans le CSV. `description` est laissée
à sa valeur DB (initialement `null`).

Les images JPEG/PNG/WebP/GIF sont limitées à 6 Mio chacune. Les téléchargements
ont un délai de 30 secondes ; les appels Supabase de 60 secondes. Les erreurs
temporaires (réseau, 408, 429, 5xx) sont retentées jusqu'à trois fois. Une image
inaccessible ou une ligne invalide est journalisée puis ignorée. Une erreur
Storage ou DB arrête l'import pour éviter d'ignorer tout un catalogue en cas
de problème de droits, de schéma ou de quota.

Les objets Storage ont un nom stable dérivé de `(source, source_id)` et les
cartes sont insérées/mises à jour sur cette même clé unique. Relancer la
commande est sans doublons : les UUID et `date_ajout` existants sont conservés.
Les images sont téléchargées à nouveau à chaque exécution. Les doublons dans
un même lot sont fusionnés avant téléchargement, avec priorité à la dernière
ligne ; d'un lot à l'autre, la dernière écriture réussie prévaut. Le compteur
`imported` compte les écritures, pas forcément les nouvelles cartes distinctes.

Storage et Postgres ne partagent pas de transaction : si une écriture DB
échoue après un upload, l'objet peut rester dans le bucket. La relance réutilise
ce même chemin, sans générer de nouvel objet orphelin à chaque tentative.

Chaque lot affiche la progression. Les échecs de lignes sont ajoutés à
`logs/import-cards-errors.jsonl` (ignoré par Git), avec identifiant de source,
numéro d'enregistrement et motif. `--error-log` permet de changer ce chemin.
Codes de sortie : `0` succès, `2` terminé avec lignes ignorées, `1` arrêt fatal.

Validation locale du CSV fourni : 102 605 lignes lues, 102 604 valides,
une ligne ignorée car son nom est vide (`source_id=358132`). Le mode
`--dry-run` ne vérifie pas l'accessibilité des images. Les tests automatisés
(`npm test`) simulent Storage et la DB ; l'import distant reste à exécuter
après configuration du schéma et de la clé serveur.

Références : [création de buckets](https://supabase.com/docs/guides/storage/buckets/creating-buckets),
[upload Storage](https://supabase.com/docs/reference/javascript/file-buckets-upload),
[lecture CSV en flux](https://csv.js.org/parse/api/async_iterator/).

## Authentification — étape 3

Les pages `/inscription` et `/connexion` utilisent les Server Actions de
`app/auth/actions.ts` et le client SSR Supabase. L'inscription envoie le pseudo
dans `options.data.pseudo` ; le trigger de la deuxième migration crée
`user_profiles` dans la transaction de création du compte, y compris quand
la confirmation email est activée. Ne pas créer le profil depuis le navigateur.
Les deux migrations doivent donc être appliquées avant les inscriptions.

Le pseudo affiché dans la navigation est lu dans `user_profiles` après
vérification du compte auprès de Supabase Auth. La session est stockée dans
les cookies SSR et renouvelée par le proxy. La déconnexion ferme la session
du navigateur courant. Les mots de passe ne sont ni journalisés ni renvoyés
dans l'état des formulaires. Les pseudos ont une limite de 30 caractères
dans le formulaire ; ils n'ont pas de contrainte d'unicité.

Configuration dans Supabase et `.env.local` :

1. Activer le fournisseur Email/password dans Auth.
2. Définir `NEXT_PUBLIC_SITE_URL=http://localhost:3000` pour le développement,
   puis l'origine HTTPS du site en production. Sans cette variable, le serveur
   de développement utilise `http://localhost:3000` ; en production,
   l'inscription refuse d'envoyer un email avec une origine indéterminée.
3. Dans Auth → URL Configuration, définir la même Site URL et autoriser
   `http://localhost:3000/auth/confirm` dans Redirect URLs, ainsi que
   l'équivalent de production. Utiliser exactement la même origine dans le
   navigateur (ne pas mélanger `localhost` et `127.0.0.1`).
4. Le modèle d'email par défaut (`{{ .ConfirmationURL }}`) fonctionne via PKCE :
   ouvrir le lien dans le navigateur où l'inscription a commencé. Pour
   permettre une confirmation depuis un autre navigateur, remplacer le lien
   du modèle **Confirm signup** par :

   ```html
   <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email">Confirmer mon adresse email</a>
   ```

`/auth/confirm` accepte ces deux formats, établit les cookies puis redirige vers
le jeu. Les liens invalides ou expirés renvoient à `/connexion` avec un message.
La destination est fixe : un paramètre `next` externe n'est jamais suivi et les
tokens sont retirés de l'URL de destination. Les réponses ne sont pas mises en
cache. Si la confirmation email est désactivée, l'inscription connecte
immédiatement le joueur.

Les comptes sont maintenant utilisés par la couche de données de l'étape 4
ci-dessous. La connexion ne migre pas les anciennes cartes locales.

Validation : `npm test`, `npm run lint` et `npm run build`. Les tests Auth
couvrent les validations serveur, la transmission du pseudo, les erreurs,
la confirmation, les redirections et la déconnexion avec Supabase simulé.
Aucun email réel n'est envoyé par ces tests. Pour une vérification réelle,
utiliser un compte de test après application des migrations et configuration
des URLs ; vérifier ensuite le pseudo dans `user_profiles`, la reconnexion
et la déconnexion.

Références : [Auth par mot de passe](https://supabase.com/docs/guides/auth/passwords),
[sessions SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client),
[modèles de confirmation email](https://supabase.com/docs/guides/auth/auth-email-templates).

## Données Supabase et Regular Pack — étape 4

Appliquer la troisième migration après les deux premières, puis importer le
catalogue. Les trois migrations sont appliquées au projet distant depuis le
24 septembre 2026. Le jeu utilise uniquement la clé publique et
la session du joueur ; la clé serveur reste réservée à l'import.

`lib/data/cards.ts` conserve ses cinq fonctions asynchrones sans arguments :
`getAllCards`, `getGameInfo`, `getUserCollection`, `getPackStatus`, `openBooster`.
Les cartes conservent les propriétés `id/name/category/rarity/image` ; les
exemplaires ajoutent toujours `instanceId/obtainedAt`. Le type `Rarity` accepte
également `LR` pour représenter fidèlement le catalogue, et `Category` accepte
les catégories texte de la base. Le Regular Pack tire uniquement C/R/SR/SSR.

Le catalogue et la collection sont lus avec pagination par UUID, y compris
au-delà de la limite de lignes de l'API Supabase. La collection filtre le
joueur authentifié et reste protégée par RLS. Les exemplaires sont triés par
rareté décroissante puis date décroissante ; le reveal garde l'ordre inverse
des raretés. Les doublons ont chacun leur UUID et date d'obtention.

Les fonctions SQL du jeu sont appelées par RPC :

- `get_game_info()` renvoie le profil du joueur, les catégories du catalogue
  et les taux du pack. `get_regular_pack_status()` calcule la disponibilité
  sur l'heure de la base. Ces lectures utilisent les droits du joueur.
- `open_regular_pack()` utilise des droits serveur strictement limités à la
  fonction. Elle identifie le joueur par `auth.uid()`, verrouille son profil
  avec `FOR UPDATE`, contrôle le timer, tire cinq cartes, insère cinq exemplaires
  et consomme un pack dans la même transaction. Elle n'accepte aucun paramètre :
  le navigateur ne choisit ni le joueur, ni la rareté, ni les cartes, ni l'heure.

Les taux sont C 71,9 %, R 20 %, SR 7 %, SSR 1 %, LR 0,1 %, avec choix uniforme parmi
les cartes de la rareté tirée. Seule une LR reçoit un second jet Shiny à 0,1 % ; une
SSR Shiny s’obtient exclusivement en faisant évoluer trois SSR non-Shiny identiques.
Un index `(rarete_base, id)` permet de tirer
par décalage aléatoire sans trier tout le catalogue aléatoirement. Si une des
cinq raretés n'est pas encore importée, l'ouverture refuse de consommer le
pack. Toute erreur d'insertion ou de timer annule l'ensemble de l'ouverture.

La régénération est de 15 minutes, plafonnée à cinq packs, avec cinq packs
initiaux. Deux requêtes pour un seul pack disponible ne peuvent pas toutes
deux le consommer : la seconde attend le verrou puis vérifie le timer mis à
jour. Si plusieurs packs sont réellement disponibles, des requêtes distinctes
peuvent les consommer. Les écritures directes du navigateur restent interdites.

Le Decision Pack possède un délai indépendant de 24 heures. Son tirage est
persisté dans `decision_packs` et `decision_pack_choices` jusqu’au choix final,
ce qui empêche un rechargement de relancer les cinq propositions. Chaque carte
est au minimum SR : SR 97,8 %, SSR 2 %, LR 0,2 %. Les raretés C et R sont
entièrement absentes du pool. `keep_decision_pack_card()` crée
exactement un exemplaire dans la collection. Les RPC de destruction suppriment un
exemplaire Regular ou marquent un choix Decision comme détruit ; la dernière
proposition Decision restante ne peut pas être jetée.

Chaque profil possède également un `karas_balance` entier, non négatif et
initialisé à zéro. `credit_karas()` et `debit_karas()` sont des primitives
transactionnelles réservées au rôle serveur : les clients authentifiés ne
peuvent ni les appeler ni modifier directement leur solde. Le débit échoue sans
modifier le profil lorsque le solde est insuffisant.

Les dossiers personnels sont stockés dans `folders`; la clé étrangère composite
de `user_cards` garantit qu’un exemplaire ne peut être rangé que dans un dossier
de son propriétaire. Les RPC de création, suppression et rangement sont les
seules écritures accessibles au client. `is_first_owner` est posé uniquement par
les fonctions d’ouverture lorsqu’une LR rejoint directement la collection.

La table `wishlist` est nettoyée par un trigger `AFTER INSERT` sur `user_cards`.
Cette règle est donc commune aux packs et aux futures acquisitions par marché ou
trade, sans dépendre du chemin applicatif utilisé pour créer l’exemplaire.

Le module conserve les informations du joueur 60 secondes et sa collection
10 secondes en mémoire pour éviter de relire toutes les pages à chaque tick
de l'interface. Le cache est isolé par utilisateur et vidé lors d'un changement
de compte. L'ouverture invalide immédiatement la collection, y compris sur
erreur réseau. Une réponse provenant d'une session remplacée est rejetée.
Le statut des packs est relu à chaque appel et le décompte affiché est ajusté
à l'heure serveur. Aucun timer, tirage ou exemplaire n'est stocké dans le
localStorage ; la sauvegarde v0.1 existante est simplement ignorée.

Les pages `/` et `/collection` exigent désormais une session vérifiée et
redirigent sinon vers `/connexion`. Changer de compte remonte le composant
de jeu pour vider son état d'affichage. L'interface de reveal et les filtres
n'ont pas besoin d'être réécrits.

Il n'y a pas de relance automatique d'une ouverture après erreur réseau : le
serveur peut avoir validé la transaction sans que sa réponse soit arrivée.
Dans ce cas, recharger la collection et le statut permet de retrouver les
cartes et le timer validés.

Tests : `npm test` inclut les adaptateurs Supabase simulés et l'exécution des
trois migrations sur PostgreSQL via PGlite, en mémoire. Les tests SQL couvrent
le trigger d'inscription, les doublons, le timer, le plafond, le catalogue
incomplet, le rollback après insertion, les grants et l'isolation RLS entre
deux joueurs. PGlite n'a qu'une connexion : un test de contention entre deux
connexions réelles reste à réaliser sur une instance PostgreSQL/Supabase.

Références : [fonctions et droits Supabase](https://supabase.com/docs/guides/database/functions),
[verrous de lignes PostgreSQL](https://www.postgresql.org/docs/current/explicit-locking.html).

## Anciennes données locales — étape 5

La sauvegarde `yokkai-collec-v1` n'est jamais lue ni importée. Un nouveau compte
commence avec une collection vide et le timer initial défini par la base.
L'ancien écouteur d'événements `storage` du jeu a été supprimé ; les lectures
Supabase assurent désormais le rafraîchissement.

La clé historique peut rester dans le navigateur sans effet sur la partie.
Aucune suppression globale du stockage n'est effectuée, afin de conserver
les sessions Auth et les autres données du navigateur. Les tests de la couche
de données échouent explicitement si le jeu tente d'accéder au localStorage.

## Marché et enchères

La migration `20260924000005_auctions.sql` ajoute `auctions`, `bids` et
`auction_watchers`, ainsi que les RPC de publication, de mise, de suivi, de
liste et de détail. Le règlement est effectué paresseusement et
transactionnellement à chaque accès au marché : transfert de la carte et crédit
du vendeur si une mise existe, ou simple dégel dans le cas contraire. Les
tables ne sont pas directement modifiables par un compte authentifié ; toutes
les règles économiques restent concentrées dans les RPC `security definer`.

## Amis

La migration `20260924000006_friendships.sql` ajoute les demandes et relations
d’amitié. Un index fonctionnel garantit une seule relation par paire, quel que
soit l’émetteur. La recherche de pseudo, la consultation des listes, l’envoi et
la réponse passent par des RPC authentifiées ; seul le destinataire d’une
demande en attente peut l’accepter ou la refuser.

## Échanges

La migration `20260924000007_trades.sql` ajoute `trade_offers`, les cartes et
Karas proposés ou demandés, les statuts et le chaînage des contre-offres. Une
acceptation verrouille l’offre, les deux profils et les exemplaires concernés,
puis revérifie amitié, propriété, enchères actives et soldes avant tout transfert.
Une erreur annule donc toute l’opération, sans échange partiel.

Les cinq étapes sont implémentées côté application et les migrations distantes
sont appliquées. Le premier essai d'import de dix cartes et images a réussi
sans erreur le 24 septembre 2026. L'import complet a ensuite été lancé avec
dix transferts simultanés ; sa progression est dans `logs/import-20260924.log`,
les erreurs fatales dans `logs/import-20260924-stderr.log`, et les informations
du processus dans `logs/import-20260924-process.json`. Ces journaux sont locaux
et ignorés par Git. Il reste à vérifier les URLs Auth. La validation finale
doit couvrir une inscription, une confirmation email, une ouverture puis la
relecture de la collection après déconnexion et reconnexion.
