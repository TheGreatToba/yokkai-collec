# Emails Auth : anglais

**Préparation uniquement : modèles et variables non appliqués en production. Aucune migration.**

## Contenu prêt à coller

| Parcours     | Sujet complet                               | Corps HTML complet                                           |
| ------------ | ------------------------------------------- | ------------------------------------------------------------ |
| Confirmation | Confirm your email address — Yokkai Collec’ | [confirmation.html](../public/auth-emails/confirmation.html) |
| Récupération | Reset your password — Yokkai Collec’        | [recovery.html](../public/auth-emails/recovery.html)         |

Les fichiers HTML sont les corps complets prêts à copier, avec `lang="en"`. Conserver littéralement `{{ .SiteURL }}`, `{{ .TokenHash }}`, `type=signup` et `type=recovery`, ainsi que l'échappement HTML `&amp;`. Le chemin `/auth/confirm` est inchangé ; aucune URL de retour ou configuration Turnstile ne change ici. Aucun envoi d'email ou test de compte réel n'a été effectué.

## Variables et fichiers Coolify à modifier par Walid

Service Auth/GoTrue de la stack Supabase, après mise à disposition des fichiers par un déploiement autorisé :

| Variable injectée dans GoTrue        | Valeur cible exacte                                     | Action                                        |
| ------------------------------------ | ------------------------------------------------------- | --------------------------------------------- |
| GOTRUE_MAILER_SUBJECTS_CONFIRMATION  | Confirm your email address — Yokkai Collec’             | Remplacer le sujet personnalisé               |
| GOTRUE_MAILER_SUBJECTS_RECOVERY      | Reset your password — Yokkai Collec’                    | Remplacer le sujet personnalisé               |
| GOTRUE_MAILER_TEMPLATES_CONFIRMATION | https://yokkai-collec.com/auth-emails/confirmation.html | Conserver si déjà identique, sinon configurer |
| GOTRUE_MAILER_TEMPLATES_RECOVERY     | https://yokkai-collec.com/auth-emails/recovery.html     | Conserver si déjà identique, sinon configurer |

Correspondance documentée dans [auth-hardening.md](auth-hardening.md) et l'inventaire validé ; la configuration active n'a pas été relue ou modifiée pour cette PR. Si Coolify utilise des variables intermédiaires dans son compose, Walid doit vérifier leur injection vers ces quatre noms GoTrue : une variable visible mais non transmise au conteneur n'a pas d'effet. Les fichiers concernés sont `public/auth-emails/confirmation.html` et `public/auth-emails/recovery.html`, inclus dans l'image Next ; GoTrue les récupère par HTTP(S), pas par `file://`.

Sauvegarder les anciennes valeurs et les anciens HTML. Ne modifier ni `GOTRUE_SITE_URL`, ni `GOTRUE_URI_ALLOW_LIST`, ni les secrets SMTP/JWT/captcha. Recréer uniquement le service Auth si des variables changent, selon la procédure Coolify ; un simple restart ne recharge pas l'environnement Docker. Vérifier depuis Auth que les deux URLs répondent 200 et servent les marqueurs Go Template bruts, puis vérifier avec Walid un email réellement reçu dans chaque parcours. Le cache GoTrue peut garder un ancien modèle ou revenir au modèle par défaut si le chargement échoue.

## Modèles non personnalisés

Confirmé dans le [code officiel GoTrue v2.196.0](https://github.com/supabase/auth/blob/v2.196.0/internal/mailer/templatemailer/templatemailer.go) : les sujets et corps par défaut d'invitation, magic link, changement d'adresse, réauthentification et notifications de sécurité sont déjà en anglais. Aucun modèle personnalisé de ces parcours n'est livré dans ce dépôt. Cela confirme les défauts amont, sans prétendre connaître les éventuelles personnalisations actives dans Coolify ; Walid doit vérifier que leurs variables SUBJECTS/TEMPLATES ne les remplacent pas.

## Retour arrière

Restaurer les deux HTML et les valeurs sauvegardées, recréer Auth seulement si des variables ont changé, puis vérifier le contenu réellement reçu. Ne pas changer les liens d'authentification ou les paramètres de sécurité pour revenir aux textes précédents.
