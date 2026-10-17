# Stripe Pro — socle serveur, vente désactivée

## État de livraison

Branche indépendante créée depuis `origin/master` (`1523ee5`). Ce lot prépare le backend persistant ; il **ne rend pas l’offre commercialisable** et ne remplace pas l’aperçu local de la PR #300. Ne pas activer les achats, merger ou déployer sans finir la checklist ci-dessous. Aucun objet Stripe, débit ou accès Pro réel créé pendant le développement.

Migration `20261017000000_stripe_billing_foundation.sql` : **pas appliquée sur le VPS**, aucune base distante modifiée. Avant son application, coordonner avec Walid sur Discord et vérifier l’historique réel avec le script officiel du dépôt. Aucune migration de droits de jeu dans ce lot ; pas de test existant remplacé, assoupli ou ignoré.

## Parcours serveur

- `POST /api/billing/checkout` : compte déduit de la session Auth, Origin exact, corps JSON vide. Prix serveur uniquement : 499 centimes EUR, mensuel récurrent, quantité 1, prix actif et mode concordant. Aucun montant, UUID ou customer Stripe fourni par le navigateur. Pas de coupon ni de période d’essai configurés.
- Correspondance compte/customer persistée **avant** Checkout. Compte Stripe vérifié par `accounts.retrieve(null)` ; portée mode/compte/prix figée sur la ligne DB et indépendante des rotations de clé secrète. Les métadonnées sont informatives, jamais une preuve de propriété.
- Verrou DB clôturé par jeton et échéance de 90 secondes, couvrant plusieurs processus. Un worker périmé ne peut plus écrire ni libérer le verrou de son successeur. Clés d’idempotence stables pour customer et Checkout, session ouverte réutilisée, abonnements non terminés bloquant les doublons. Un ancien Checkout terminé ne bloque pas un réabonnement si son abonnement est confirmé terminé dans Stripe.
- Intention persistée avant les appels de création. Une création incertaine sans correspondance récupérée après 23 heures exige une revue opérateur, au lieu de retenter après l’expiration de la rétention d’idempotence Stripe.
- `GET /api/billing/status` : relecture Stripe et miroir DB ; renvoie seulement état actif/statut/échéance/résiliation/existence du customer, jamais d’identifiant de facturation. Un simple retour `?checkout=returned` ne confère aucun droit.
- `POST /api/billing/portal` : même authentification et protection Origin ; portail du customer enregistré côté serveur. Résiliation et factures doivent être activées dans la configuration du portail Stripe.
- `POST /api/billing/webhook` : corps brut borné à 256 Kio, signature SDK/tolérance de 300 secondes, mode et compte Connect contrôlés. API SDK verrouillée par `package-lock.json` (Stripe 23.0.0 / `2026-09-30.endive`) ; configurer la même version pour la destination webhook.
- Liste exacte des événements dans `lib/billing/subscription.ts` : Checkout, cycle d’abonnement, factures et événements de risque. Événements traités une seule fois après écriture atomique du miroir ; un échec DB/provider n’est pas acquitté comme traité. Les notifications désordonnées relisent l’état Stripe actuel, sans appliquer une vieille projection.
- Remboursement, litige ou alerte fraude : suspension conservatrice et persistante du customer concerné, y compris remboursement partiel ou autre paiement de ce customer. Aucun rétablissement automatique après un ancien événement ou un litige gagné ; revue opérateur obligatoire. Confirmer cette politique avant lancement.
- Pro requiert abonnement `active`, non suspendu, un seul article au bon prix/quantité et facture payée positive du même abonnement, couvrant la période de cet article. `trialing`, `past_due`, `unpaid`, `incomplete`, `paused`, prix/mode différents et réponse provider tronquée ne donnent pas Pro. Annulation en fin de période conserve l’accès payé jusqu’à échéance. Les crédits/coupons entraînant une facture à zéro ne sont pas pris en charge dans cette première offre.

## Droits SQL et fraîcheur

Tables `billing_accounts` et `billing_webhook_events` : RLS activée sans politique joueur, tous droits retirés à PUBLIC/anon/authenticated. Fonctions `SECURITY INVOKER`, `search_path` vide, exécution service_role seulement. Aucun élargissement de l’allowlist SECURITY DEFINER ni écriture de statut Pro par un joueur.

`billing_has_pro(uuid,text)` est un prédicat **interne**, destiné au prochain lot de fonctions de jeu. Il contrôle portée, actif, statut, suspension, échéance et vérification datant de moins de 15 minutes. Il n’est pas encore appelé par les RPC de jeu et n’ajoute aucun avantage dans ce lot.

`POST /api/billing/reconcile?after=<UUID>` : secret Bearer serveur indépendant de 32 caractères minimum, comparaison constante, pagination par UUID et budget de travail d’environ 20 secondes hors dernier appel provider. Retourne `checked`, `failed`, `next`. Le scheduler doit suivre **tous** les curseurs, inspecter les échecs même avec un curseur non nul, puis retenter les comptes en erreur. Sans relecture assez récente, les futurs droits SQL se ferment ; ne pas remplacer la panne Stripe par un accès optimiste.

## Configuration et exploitation à préparer

1. Prix final **confirmé par le produit : 4,99 EUR mensuels, sans essai gratuit**. Identifiant fourni par le propriétaire : `price_1URdBZIuXkg5OZqmJiQZmOr7`, déclaré en mode réel. Montant, récurrence, devise, mode et compte restent **à vérifier par l’API Stripe** avec les secrets installés sur le serveur ; l’identifiant seul ne constitue pas cette vérification. Aucun changement de produit ou prix réel automatisé ici.
2. Déposer les secrets uniquement dans le gestionnaire de secrets du VPS : `STRIPE_SECRET_KEY`, `STRIPE_PRO_WEBHOOK_SECRET`, `STRIPE_RECONCILIATION_SECRET`, clé serveur Supabase existante. Les identifiants `STRIPE_ACCOUNT_ID` et `STRIPE_PRO_PRICE_ID` peuvent être communiqués sans clé secrète. Ne jamais coller les clés dans le chat, les logs, le dépôt ou une variable `NEXT_PUBLIC_`.
3. Copier le modèle `.env.billing.example` hors Git. Par défaut **les deux flags restent false**. Mode test accepté uniquement en développement sur app/DB loopback ; mode live uniquement sur origine exacte `https://yokkai-collec.com`, build production, DB HTTPS non locale. Incohérence ou configuration absente : refus avant Stripe.
4. Installer la destination webhook et ses événements exacts, le portail client et un scheduler de réconciliation au moins toutes les cinq minutes. Ajouter alerte sur erreurs webhook, drift, factures échouées et comptes à risque. Vérifier la pagination avec la charge réelle avant lancement. Maintenance prolongée peut retarder les webhooks : la réconciliation doit restaurer un état frais avant réouverture.
5. Répéter en mode test : 3DS, paiement refusé, abandon, retry, renouvellement, résiliation, échéance, réabonnement, remboursement/litige, notification répétée/désordonnée, coupure réseau et DB. Pas de paiement live « de test » automatisé.

Préparation de la configuration de production, **sans activation** (ne pas charger ces valeurs dans le serveur de développement) :

```dotenv
STRIPE_BILLING_ENABLED=false
STRIPE_CHECKOUT_ENABLED=false
STRIPE_BILLING_MODE=live
STRIPE_ACCOUNT_ID=acct_1UQSidIuXkg5OZqm
STRIPE_PRO_PRICE_ID=price_1URdBZIuXkg5OZqmJiQZmOr7
```

L’identifiant de compte `acct_1UQSidIuXkg5OZqm` a été fourni par le propriétaire, mais reste à vérifier auprès de Stripe, comme le tarif. Les secrets restent hors dépôt. Le modèle `.env.billing.example` conserve son mode test, son compte et son tarif vides pour ne jamais mélanger ces identifiants réels avec une clé de test. Les deux flags ci-dessus restent false jusqu’à la livraison et à la validation de tous les lots obligatoires.

### Vérification serveur sans activation

Après installation des variables dans le gestionnaire de secrets du serveur, et lorsque ce script est disponible dans le conteneur de la branche de préparation, lancer `node scripts/check-stripe-setup.mjs`. Ne pas copier une clé live dans l’environnement local pour cette vérification.

Ce script refuse de démarrer hors `NODE_ENV=production`, avec une autre origine ou si un des flags n’est pas explicitement `false`. Il appelle uniquement `GET /v1/account` et `GET /v1/prices/<id>` via le SDK officiel, vérifie le compte, le mode réel et le tarif actif 499 centimes EUR mensuel récurrent. Aucun client, Checkout, abonnement ou paiement créé, aucune écriture SQL. La sortie ne contient pas la clé, de réponse fournisseur brute ou d’identifiant financier. Un succès confirme ces contrôles uniquement, **pas** la préparation du webhook ou des avantages, ni l’autorisation d’ouvrir les achats.

## Conditions obligatoires avant vente — lots suivants

- Intégrer proprement l’interface `/premium` des PR #300/#304, retirer ses mentions de prototype **seulement** lorsque tous les bénéfices annoncés sont fonctionnels et vérifiés ; brancher ses actions sur ces routes de facturation. Les URLs de retour `/premium` sont prévues pour cette intégration, la page n’existe pas encore dans ce lot indépendant.
- Faire contrôler **en SQL**, atomiquement, les nouvelles limites et délais : Basic/Pro 3/6 enchères, Regular Pack 10/5 minutes, Decision Pack 24/12 heures et vitrine 5/10. Ne pas toucher aux probabilités par carte. Définir downgrade/expiration sans suppression arbitraire de cartes, médias ou ventes.
- Persister le style Pro et appliquer les restrictions de personnalisation au serveur/Storage, pas seulement au bouton grisé. Désormais la page locale reste inchangée sur le port 3000 ; son état en mémoire ne devient pas un droit de production.
- Définir objectifs et montants des succès Pro donnant des Karas, puis réclamations SQL atomiques/idempotentes. Les récompenses restent non définies par le produit ; ne pas en inventer.
- Ajouter une limite de fréquence durable aux endpoints avant exposition commerciale (le lease évite les créations concurrentes, ce n’est pas un quota de requêtes).
- Adapter la suppression de compte **avant activation** : résilier chez Stripe, gérer les opérations en cours et les règles de conservation des données de facturation. Le FK cascade seul ne résilie pas chez Stripe ; il ne doit jamais être utilisé comme parcours de suppression d’un abonné payant.
- Vérifier CGV, informations de renouvellement/résiliation, TVA et support avec les responsables concernés ; cette PR n’en définit pas la politique. Obtenir le feu vert produit et sécurité, CI verte sur branche à jour, coordonner les migrations, puis seulement activer la vente.

## Références officielles consultées

- https://docs.stripe.com/billing/subscriptions/webhooks
- https://docs.stripe.com/webhooks
- https://docs.stripe.com/customer-management/integrate-customer-portal

Graphify a servi à retrouver le parcours et les limites du prototype existant ; les nouvelles protections ont ensuite été vérifiées directement dans les sources et dans PostgreSQL jetable (tests ciblés). La CI complète reste exécutée uniquement sur GitHub Actions.
