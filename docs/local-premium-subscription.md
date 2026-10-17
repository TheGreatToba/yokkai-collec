# Yokkai Pro — essai local uniquement

## Périmètre

- Page `/premium`, formule mensuelle **4,99 EUR**. Nouvelle offre Pro proposée : personnalisation, packs plus fréquents, limites augmentées et succès donnant des Karas.
- Comparatif **sans droits réels** : Regular Pack 10 → 5 minutes, Decision Pack 24 → 12 heures, enchères simultanées 3 → 6, vitrine 5 → 10. Aucun changement des probabilités par carte.
- Page de présentation uniquement : avantages Pro, comparatif Basic/Pro, bannière GIF du compte **BBDOU** et abonnement mensuel. Ni démo interactive, ni activation simulée, ni sélecteur de thèmes, ni sauvegarde de style dans la page.
- Les médias sont une copie locale du 17 octobre 2026 dans `public/assets/premium-examples/`. GIF original non converti (498 × 281, 23 images) ; image fixe extraite pour la pause et `prefers-reduced-motion`. Aucun bouton « Pause GIF » visible sous la bannière : elle démarre automatiquement et reste activable au clic ou au clavier pour l’accessibilité. Aucun appel de profil ou de média de production pendant l’affichage, aucun accès Pro conféré au compte d’exemple.
- À côté de « Animated banners », exemple d’illustration personnalisée : la vraie carte **SATORU GOJOU**, **JUJUTSU KAISEN**, LR (`60c0cdbe-2ed5-43f9-aac3-c2bdfa5e4867`), puis exactement la même carte avec le GIF `gojo-satoru.gif` fourni par l’utilisateur. Le composant commun `YokaiCard` conserve cadre, nom, licence, catégorie et rareté ; seule l’image change. Les deux blocs sont côte à côte sur ordinateur et empilés sous 960 px.
- Illustration originale copiée depuis le catalogue local (PNG 230 × 345) ; GIF fourni copié sans modification (498 × 281, 29 images, boucle infinie). Image fixe pour la réduction des mouvements, contrôle accessible au clic/clavier sur la carte. Aucun formulaire d’édition, mutation de collection ou changement de droit Pro.
- Liste complète des 13 avantages fournie par le produit dans `lib/premium/offer.ts`. Le bandeau local précise que les avantages ne sont pas encore actifs. Les règles Basic décrivent l’offre cible, pas un audit des droits actuels.
- Stripe Checkout hébergé en mode abonnement, portail client, webhook signé et vérification serveur de l’abonnement. Le prix est affiché depuis la configuration serveur/partagée ; le client n’envoie ni prix, ni identité dans ses requêtes de paiement.
- Sans configuration Stripe, le bouton d’abonnement connecté est désactivé et indique la cause. Aucun bouton de configuration technique ou alternative de démo n’est affiché.
- L’ancien studio `components/premium-experience.tsx`, le simulateur et leurs tests restent conservés pour la régression du prototype, mais ne sont importés par aucune route. La page utilise `PremiumOffer` et `PremiumCheckout` ; le code de la démo n’entre pas dans son parcours.
- Aucun changement des fonctionnalités gratuites en production ; pas de restriction rétroactive de la personnalisation du profil. L’essai local verrouille désormais l’application d’images de cartes pour les comptes Basic, sans retirer leurs anciennes images.
- Aucun changement de base Supabase, aucune migration. Rien appliqué sur le VPS.

## Personnalisation du profil — aperçu local

- Sur `/profile`, le propriétaire dispose de **Style profile** uniquement quand `localPremiumEnabled()` est vrai. Les routes publiques `/profile/[id]` et les autres comptes n’affichent pas cet éditeur. Aucun abonnement n’est activé et aucune donnée du profil n’est écrite.
- Modale inspirée du principe d’édition Discord, avec une présentation Yokkai sombre/lavande : huit styles de police, sept effets (Solid, Gradient, Neon, Outline, Pop, Shimmer, Prism), palette et deux couleurs personnalisées. Polices déjà chargées ou polices système ; aucune dépendance de police distante supplémentaire.
- Aperçu immédiat du pseudo sur une fiche de profil et une conversation fictive. Le profil réel local ne change qu’après **Apply locally** ; Cancel, fermeture et Échap abandonnent les modifications. Réouverture avec le style appliqué, Reset et Surprise me disponibles.
- Le badge Pro lavande reste distinct de six badges décoratifs (Comet, Bloom, Crystal, Orbit, Flame, Moon), limités à trois. Aucun choix de rôle administrateur/modérateur, de certification ni de succès débloqué.
- L’état reste uniquement en mémoire dans l’onglet local : il suit la navigation client entre pages, mais un rechargement complet le réinitialise. Le pseudo (police, couleurs, effet), le badge Pro de démonstration et les badges décoratifs sont repris dans les auteurs des messages d’enchères et des posts du mur. L’association utilise l’identifiant du compte, jamais le pseudo. Aucun style n’est attribué à un autre joueur portant le même nom.
- Le lien **Preview chat & wall** ouvre `/design-system/profile-style-sharing-preview`, protégé par le garde local et une connexion, avec les vrais composants UI et des adaptateurs fictifs en lecture seule (y compris signalements et blocages). Les autres joueurs et navigateurs ne voient pas cet essai. Aucune persistance navigateur, requête d’écriture, migration ni changement de droits SQL. Le branchement aux vrais comptes Pro et la sauvegarde sont une étape distincte.
- Aperçu mobile empilé ; modale commune conservée pour le focus, le clavier et le blocage du défilement de fond. Shimmer désactivé avec `prefers-reduced-motion`.

## Personnalisation des cartes — verrouillage d’interface local

- Dans les modales de collection et de cartes obtenues dans les packs, **Apply** est désactivé pour Basic, y compris avec une URL remplie. Message anglais explicite et lien **Discover Yokkai Pro**. L’URL reste saisissable ; aucune prévisualisation distante ni application n’est lancée.
- Le statut provient de `getPremiumState` côté serveur sur les routes connectées, et non du badge Pro de démonstration. Sans configuration, sans abonnement actif ou en cas d’erreur, l’interface locale reste verrouillée. Un abonnement test configuré et actif conserve l’action. Le gestionnaire d’application contrôle aussi l’accès avant l’appel existant de sauvegarde.
- **Restore original image** reste possible pour Basic : ce n’est pas l’ajout d’une nouvelle personnalisation. Aucun média existant n’est supprimé automatiquement.
- Ce garde est activé uniquement par `localPremiumEnabled()`. Aucun droit existant n’est changé en production. C’est un verrouillage d’interface de prototype, pas encore une protection de l’accès SQL : avant livraison publique, persister/réconcilier les abonnements et protéger `set_card_custom_image` côté serveur/SQL avec les tests de droits appropriés. Aucun abonnement réel, migration ni droit de base modifié ici.

## Médias de profil — même verrouillage d’interface local

- Les pages de profil (`/profile` et ses alias) utilisent le même statut d’abonnement test vérifié côté serveur que la collection, associé au compte connecté, et non au propriétaire visité ni au badge d’aperçu.
- Pour Basic, **Upload banner** est désactivé avec le message **Custom banners are available to Pro members only.** et un lien vers Pro. Le gestionnaire de sélection, la validation du cadrage et la sauvegarde refusent aussi un nouveau fichier avant tout envoi. Une bannière déjà importée reste conservée ou supprimable, mais son ajustement est réservé à Pro. Les cartes possédées et leur cadrage restent accessibles.
- Le sélecteur de photo autorise JPG/PNG/WebP pour Basic ; un GIF est refusé avant l’envoi avec **Animated profile photos are available to Pro members only.** Détection par type, extension et signature GIF pour les fichiers renommés. Pro conserve GIF et formats fixes. Le sélecteur est réinitialisé après chaque choix, afin de pouvoir choisir de nouveau un fichier rejeté.
- La bio, les photos fixes, la vitrine et la sauvegarde sans nouveau média restent utilisables ; aucun avatar ni bannière antérieurs ne sont retirés automatiquement. Vérification navigateur sans écriture de profil ou de Storage, et tests d’adaptateurs Basic/Pro, GIF renommés et conservation des médias existants.
- Comme pour les cartes, ce verrou est limité à l’interface de l’essai local. Une véritable protection serveur/Storage/SQL sera nécessaire avant production. Aucune migration ni changement des droits existants de production.

## Accès Basic/Pro — contrôles locaux

- **Style profile** est désactivé pour Basic avec **Profile styling is available to Pro members only.** et un lien vers Pro. L’éditeur ne s’ouvre pas, son gestionnaire Apply refuse Basic et le hook partagé refuse aussi de publier un nouveau style. Le lien d’aperçu chat/mur n’est présenté qu’à Pro. Police, effets et badges décoratifs du profil ne sont pas affichés pour Basic ; le badge Pro de démonstration est également masqué pour Basic.
- Dans la Collection et les détails des packs, le quota local est de **3 enchères actives Basic / 6 Pro**. Le bouton et la confirmation sont désactivés quand le quota connu est plein. Le gestionnaire relit les enchères du compte juste avant la création et refuse si la limite est atteinte ou si la lecture échoue ; verrou synchrone contre un double appel dans le même composant. Les enchères déjà en cours ne sont pas supprimées, même au-dessus du plafond. Annulation et participation restent disponibles.
- Le quota déduplique les identifiants de vente et exclut les fins passées ; une date invalide ne libère pas de place. Le compteur suit les actualisations existantes. Les tests couvrent 3/6, lecture fraîche, erreur et concurrence locale ; la preuve navigateur simule uniquement la réponse de lecture, sans créer de vente.
- Les limites de jeu restent un **essai d’interface**, pas un verrou SQL anti-contournement : plusieurs navigateurs ou un appel RPC direct ne sont pas protégés par ce prototype. Implémenter les contrôles atomiques en base et la réconciliation de l’abonnement avant production. Hors essai local, droits de production inchangés.
- Audit des avantages : images de cartes, imports de bannière, avatars GIF, style et badges Pro ont un garde local. Basic conserve la vitrine de 5 et les délais de jeu existants ; les variantes Pro 10 places et délais 5 min/12 h ne sont pas encore activées. Fonds personnels, cadres exclusifs, thèmes complets, effets de vitrine et dos personnalisés restent non implémentés ; aucun accès réel n’est donc accordé à Basic. Les nouveaux succès Pro et leurs récompenses ne sont pas créés tant que les objectifs et montants ne sont pas définis.

## Démarrer

Branche `ad/local-premium-subscription`, dossier `.worktrees/local-premium-subscription`.

Configurer `.env.local` avec le Supabase **local existant**, `NEXT_PUBLIC_SITE_URL=http://localhost:3000` et les valeurs Stripe de `.env.premium.example`, puis :

```powershell
npm.cmd install
npm.cmd run dev -- --port 3000
```

Ouvrir `http://localhost:3000/premium`. La présentation de l’offre est accessible sans connexion. Le bouton **Sign in to subscribe** mène à la connexion ; un joueur connecté voit **Subscribe — €4.99/month**. Sans clés Stripe de test, ce bouton reste désactivé. La consultation de la page ne crée aucun client ni abonnement Stripe.

La page et toutes les API renvoient 404 sauf en `NODE_ENV=development`, avec `LOCAL_PREMIUM_ENABLED=true`, origine du site loopback et Supabase loopback. Une clé Stripe réelle est refusée. Les mutations authentifiées exigent la même origine et n’acceptent aucun identifiant joueur, prix ou client fourni par le navigateur.

## Brancher le vrai parcours Stripe test

1. Dans le sandbox Stripe, créer un produit Yokkai Pro et un prix récurrent **4,99 EUR / mois**, un exemplaire, sans période d’essai. Aucun objet Stripe n’est créé automatiquement avant action explicite sur Checkout.
2. Ajouter uniquement côté serveur `STRIPE_SECRET_KEY=sk_test_…` et `STRIPE_PREMIUM_PRICE_ID=price_…`. Ne jamais envoyer la clé secrète dans le chat, dans le navigateur ou dans Git.
3. Installer/authentifier Stripe CLI et lancer :

```text
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to http://localhost:3000/api/premium/webhook
```

4. Reporter le secret `whsec_…` affiché par CLI dans `STRIPE_WEBHOOK_SECRET` puis redémarrer Next. Le serveur refuse d’ouvrir Checkout sans cette configuration.
5. Activer le portail client dans le **même sandbox**, avec factures, modification de carte et résiliation à la fin de période. Désactiver les changements vers d’autres offres pour cet essai.
6. Se connecter à un compte Supabase local puis choisir **Subscribe — €4.99/month**. Carte test Stripe : `4242 4242 4242 4242`, date future, CVC quelconque ; jamais une vraie carte.
7. Au retour, l’abonnement est relu depuis Stripe. Le paramètre de retour ne donne aucun droit. L’état est également relu au retour du focus sur la fenêtre après utilisation du portail. **Manage subscription** ouvre la gestion de facturation.

## Sécurité et limites assumées

- SDK officiel Stripe ; clés `sk_test_` uniquement, `livemode` refusé ; prix serveur vérifié à 499 centimes EUR mensuels, quantité fixée à 1.
- Compte Stripe lié au JWT Supabase, jamais à un email ou un userId envoyé par le navigateur. Idempotence pour le client et Checkout, session ouverte réutilisée, abonnements existants bloquant les doublons.
- Premium uniquement si abonnement Stripe `active`, prix autorisé, période non expirée et collecte non suspendue. Pas de droit pour `incomplete`, `past_due`, `unpaid`, `canceled`, `paused` ou un retour Checkout seul. Résiliation en fin de période conserve l’accès jusqu’à la fin si Stripe le garde actif.
- Webhook : corps brut borné, signature SDK/tolérance 300 s, événements test uniquement, déduplication, mapping local du client et relecture de l’état courant Stripe plutôt que de faire confiance à un ancien événement. Aucune donnée de carte bancaire, clé ou corps d’événement stocké.
- L’ancienne API de sauvegarde du studio, non appelée depuis cette page, conserve sa vérification serveur avant chaque sauvegarde. Aucun test de droit existant n’est supprimé ni affaibli.
- État local dans `.local-premium/<empreinte-de-configuration>/state.json`, ignoré par Git. Écritures atomiques et verrou exclusif couvrant les processus Next. Pas de stockage exploitable en production ; prévoir une vraie table, ses droits SQL, gestion de cycle de vie, réconciliation et suppression de compte avant toute livraison réelle.
- En cas d’arrêt brutal pendant une opération, le verrou `state.lock` peut rester. Arrêter d’abord tous les serveurs de cette branche, vérifier l’absence d’opération Stripe en cours, puis retirer **uniquement** le verrou concerné. Ne pas effacer l’état clients pour recommencer : cela perdrait le lien avec les abonnements test existants.
- Les cosmétiques sont des prototypes dans le studio ; leur intégration aux profils réels est une étape distincte. Aucun prix ni bénéfice commercial n’est livré au public.
- La vente future de boosters reste hors périmètre. Validation produit, juridique et Stripe du modèle avant paiement réel.

## Activation des avantages réels — étape distincte

La validation de Walid pour les nouvelles règles produit et une PR de tests séparée a été confirmée par l’utilisateur. Cette PR locale ne modifie ni n’affaiblit les tests existants. Les probabilités de rareté par carte restent inchangées ; les ouvertures plus fréquentes constituent bien un avantage de progression.

- L’éligibilité Pro devra être persistée et réconciliée côté serveur après vérification Stripe, protégée contre les écritures joueur ; aucun drapeau du navigateur ni simulateur ne doit accorder de droits.
- Délais, limites d’enchères et vitrine devront être contrôlés dans les fonctions SQL existantes avec tests de concurrence, annulation/expiration et transitions Basic/Pro. Définir le traitement d’une vitrine de 10 ou de 6 enchères lors d’une expiration avant d’appliquer les nouvelles limites.
- Les droits de personnalisation (imports/GIFs, images de cartes, effets, cadres, badge, thèmes et dos) devront être vérifiés côté serveur. Aucun privilège ne sera supprimé aux joueurs gratuits par ce prototype. Définir le traitement des contenus antérieurs.
- Les succès Pro supplémentaires donneront **des Karas**, conformément à la demande. Leurs objectifs et montants restent à définir ; ne pas inventer de récompenses ni modifier les succès gratuits. Les réclamations devront être atomiques, idempotentes et contrôlées côté SQL, avec une règle explicite pour une expiration d’abonnement.
- Choisir une politique de médias externes : URL d’image directe validée, taille/type autorisés, aucun chargement serveur arbitraire de pages Pinterest/Imgur ou contournement de leurs restrictions.
- Les migrations, la PR de tests et une validation de sécurité sont nécessaires avant un essai des droits réels ; aucune migration ni intervention en production n’est réalisée ici.

## Sources techniques

- https://docs.stripe.com/payments/checkout/build-subscriptions
- https://docs.stripe.com/customer-management/integrate-customer-portal
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/webhooks/signature

## Livraison

Essai local, PR en brouillon uniquement. Ne pas merger ni déployer. Aucun test existant affaibli ; seul un mock du nouveau composant d’identité est ajouté au harnais des tests du chat, sans changer leurs assertions. Pas de migration Supabase.
