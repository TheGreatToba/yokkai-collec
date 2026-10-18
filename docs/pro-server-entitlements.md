# Pro : droits serveur après paiement

## Contrat

Les droits dérivent exclusivement du miroir Stripe privé écrit après validation de la signature du webhook et relecture du paiement. Ni le retour Checkout, ni un paramètre client, ni les métadonnées du profil n'accordent Pro.

Un abonnement doit être actif, payé, non suspendu pour risque, non expiré, vérifié depuis moins de 15 minutes et appartenir au compte/tarif/mode configuré dans la base. Un paiement Sandbox ne donne aucun droit dans le périmètre live.

| Droit                                            | Basic      | Pro       |
| ------------------------------------------------ | ---------- | --------- |
| Regular Pack                                     | 10 minutes | 5 minutes |
| Decision Pack                                    | 24 heures  | 12 heures |
| Enchères actives                                 | 3          | 6         |
| Cartes en vitrine                                | 5          | 10        |
| Nouvelle image de carte Imgur/Pinterest          | Non        | Oui       |
| Bannière importée, avatar animé, style de profil | Non        | Oui       |

La réserve Regular reste limitée à cinq packs, les Decision Packs ne s'accumulent pas et les probabilités de rareté ne changent pas. Les succès Pro restent annoncés mais leur logique et leurs récompenses sont différées.

Les transitions préservent la progression des packs. Une rétrogradation ne supprime ni cartes, ni ventes déjà actives, ni vitrine existante. Elle refuse les nouvelles actions dépassant Basic et masque le style enregistré, qui reste récupérable.

## Personnalisation

`GET /api/pro/benefits` expose uniquement les droits de l'utilisateur authentifié. `GET/POST /api/pro/profile-style` conserve un style borné et validé en base. Les projections publiques du profil, du chat d'enchères et du mur ajoutent le style actif après leurs contrôles de confidentialité existants.

`POST /api/profile-media` valide les octets (GIF, APNG et WebP animés compris), limite à 4 MiB, réserve un chemin immuable dans le dossier de l'utilisateur authentifié et applique un quota serveur. Basic conserve les avatars statiques. Le navigateur ne peut ni choisir un propriétaire, ni remplacer les octets d'un avatar statique validé par un GIF. Les anciens imports directs restent disponibles uniquement pour Pro.

## Migrations et exploitation

- `20261018000001_pro_game_entitlements.sql`
- `20261018000002_pro_showcase.sql`
- `20261018000003_pro_personalization.sql`

Non appliquées au VPS. Les droits sont fermés par défaut après migration. Cette branche dépend de la fondation Stripe (PR #307) ; aucun secret ou paiement réel n'est ajouté ici.

Après coordination Discord et vérification de l'historique réel des migrations, effectuer la prévalidation serveur et configurer le périmètre avec `node scripts/configure-pro-entitlements.mjs --enable` dans l'environnement cible. Ce script exige les deux indicateurs de paiement fermés et relit le compte/tarif chez Stripe avant d'activer les droits du périmètre exact. Il n'ouvre pas Checkout. Ne jamais passer les secrets en arguments ni les ajouter au dépôt.

Avant ouverture des paiements live : CI verte sur une branche à jour, déploiement de la fondation et de ses migrations, webhook live signé opérationnel, réconciliation planifiée réellement exécutée plus souvent que la fraîcheur maximale de 15 minutes, et cycle paiement/résiliation vérifié. Une panne de synchronisation retire les droits plutôt que de conserver un abonnement inconnu. L'annulation de l'abonnement lors d'une suppression de compte reste un prérequis de lancement de la fondation.

L'intégration visuelle des contrôles du prototype de personnalisation doit consommer ces droits réels ; la présence d'une option grisée dans l'interface ne remplace jamais les gardes SQL/API.

Les contrats historiques d'upload gratuit sont adaptés dans une PR de tests séparée, conformément à la validation de Walid. Les assertions de propriété, de confidentialité, de formats et de taille restent couvertes.
