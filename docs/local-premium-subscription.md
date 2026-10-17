# Yokkai Plus — essai local uniquement

## Périmètre

- Page `/premium`, formule mensuelle **4,99 EUR**, sans booster payant ni avantage de gameplay.
- Aperçu interactif sans paiement : trois thèmes, cadre d’avatar, badge, couleur du pseudo et dos de carte. Aucun effet sur le profil public.
- Stripe Checkout hébergé en mode abonnement, portail client, webhook signé, vérification serveur de l’abonnement et sauvegarde du thème dans le studio local.
- Aucun changement des fonctionnalités gratuites existantes ; pas de restriction rétroactive de la personnalisation du profil.
- Aucun changement de base Supabase, aucune migration. Rien appliqué sur le VPS.

## Démarrer

Branche `ad/local-premium-subscription`, dossier `.worktrees/local-premium-subscription`.

Configurer `.env.local` avec le Supabase **local existant** et les valeurs de `.env.premium.example`, puis :

```powershell
npm.cmd install
npm.cmd run dev -- --port 3001
```

Ouvrir `http://localhost:3001/premium`. Sans connexion ni clé Stripe, le bouton **Try the interactive demo** fonctionne. Le mode démo ne contacte pas Stripe, ne saisit aucune carte bancaire et ne crée aucun abonnement. Recharger la page réinitialise cette démo.

La page et toutes les API renvoient 404 sauf en `NODE_ENV=development`, avec `LOCAL_PREMIUM_ENABLED=true`, origine du site loopback et Supabase loopback. Une clé Stripe réelle est refusée. Les mutations authentifiées exigent la même origine et n’acceptent aucun identifiant joueur, prix ou client fourni par le navigateur.

## Brancher le vrai parcours Stripe test

1. Dans le sandbox Stripe, créer un produit Yokkai Plus et un prix récurrent **4,99 EUR / mois**, un exemplaire, sans période d’essai. Aucun objet Stripe n’est créé automatiquement avant action explicite sur Checkout.
2. Ajouter uniquement côté serveur `STRIPE_SECRET_KEY=sk_test_…` et `STRIPE_PREMIUM_PRICE_ID=price_…`. Ne jamais envoyer la clé secrète dans le chat, dans le navigateur ou dans Git.
3. Installer/authentifier Stripe CLI et lancer :

```text
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,invoice.paid,invoice.payment_failed --forward-to http://localhost:3001/api/premium/webhook
```

4. Reporter le secret `whsec_…` affiché par CLI dans `STRIPE_WEBHOOK_SECRET` puis redémarrer Next. Le serveur refuse d’ouvrir Checkout sans cette configuration.
5. Activer le portail client dans le **même sandbox**, avec factures, modification de carte et résiliation à la fin de période. Désactiver les changements vers d’autres offres pour cet essai.
6. Se connecter à un compte Supabase local puis choisir **Subscribe in Stripe test mode**. Carte test Stripe : `4242 4242 4242 4242`, date future, CVC quelconque ; jamais une vraie carte.
7. Au retour, l’abonnement est relu depuis Stripe. Le paramètre de retour ne donne aucun droit. **Refresh subscription status** permet de relire après une modification du portail.

## Sécurité et limites assumées

- SDK officiel Stripe ; clés `sk_test_` uniquement, `livemode` refusé ; prix serveur vérifié à 499 centimes EUR mensuels, quantité fixée à 1.
- Compte Stripe lié au JWT Supabase, jamais à un email ou un userId envoyé par le navigateur. Idempotence pour le client et Checkout, session ouverte réutilisée, abonnements existants bloquant les doublons.
- Premium uniquement si abonnement Stripe `active`, prix autorisé, période non expirée et collecte non suspendue. Pas de droit pour `incomplete`, `past_due`, `unpaid`, `canceled`, `paused` ou un retour Checkout seul. Résiliation en fin de période conserve l’accès jusqu’à la fin si Stripe le garde actif.
- Webhook : corps brut borné, signature SDK/tolérance 300 s, événements test uniquement, déduplication, mapping local du client et relecture de l’état courant Stripe plutôt que de faire confiance à un ancien événement. Aucune donnée de carte bancaire, clé ou corps d’événement stocké.
- Le studio utilise cette même vérification serveur avant chaque sauvegarde. La démo ne peut pas appeler une mutation privilégiée.
- État local dans `.local-premium/<empreinte-de-configuration>/state.json`, ignoré par Git. Écritures atomiques et verrou exclusif couvrant les processus Next. Pas de stockage exploitable en production ; prévoir une vraie table, ses droits SQL, gestion de cycle de vie, réconciliation et suppression de compte avant toute livraison réelle.
- En cas d’arrêt brutal pendant une opération, le verrou `state.lock` peut rester. Arrêter d’abord tous les serveurs de cette branche, vérifier l’absence d’opération Stripe en cours, puis retirer **uniquement** le verrou concerné. Ne pas effacer l’état clients pour recommencer : cela perdrait le lien avec les abonnements test existants.
- Les cosmétiques sont des prototypes dans le studio ; leur intégration aux profils réels est une étape distincte. Aucun prix ni bénéfice commercial n’est livré au public.
- La vente future de boosters reste hors périmètre. Validation produit, juridique et Stripe du modèle avant paiement réel.

## Sources techniques

- https://docs.stripe.com/payments/checkout/build-subscriptions
- https://docs.stripe.com/customer-management/integrate-customer-portal
- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/webhooks/signature

## Livraison

Essai local, PR en brouillon uniquement. Ne pas merger ni déployer. Aucun test existant modifié ou affaibli. Pas de migration Supabase.
