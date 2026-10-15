# Emails Auth : anglais

**Préparation uniquement : modèles et variables non appliqués en production. Aucune migration.**

## Contenu prêt à coller

| Parcours     | Sujet complet                               | Corps HTML complet                                           |
| ------------ | ------------------------------------------- | ------------------------------------------------------------ |
| Confirmation | Confirm your email address — Yokkai Collec’ | [confirmation.html](../public/auth-emails/confirmation.html) |
| Récupération | Reset your password — Yokkai Collec’        | [recovery.html](../public/auth-emails/recovery.html)         |

Les fichiers HTML sont les corps complets prêts à copier, avec `lang="en"`. Conserver littéralement `{{ .SiteURL }}`, `{{ .TokenHash }}`, `type=signup` et `type=recovery`, ainsi que l'échappement HTML `&amp;`. Le chemin `/auth/confirm` est inchangé ; aucune URL de retour ou configuration Turnstile ne change ici. Aucun envoi d'email ou test de compte réel n'a été effectué.

## Variables et fichiers Coolify à modifier par Walid

État vérifié en lecture seule le 15/10/2026 : les quatre valeurs sont **vides** dans le fichier Coolify et le conteneur Auth. Les exemples français de l'ancien guide étaient des valeurs proposées, pas la configuration active. GoTrue utilise actuellement ses modèles/sujets par défaut anglais pour ces deux parcours. Aucun secret n'a été relevé ni aucune variable modifiée.

Dans l'interface Coolify, stack Supabase, modifier les variables **MAILER_*** ci-dessous. Le compose les transmet aux noms **GOTRUE_MAILER_*** du conteneur Auth :

| Variable Coolify à modifier   | Variable GoTrue alimentée            | Ancienne valeur à sauvegarder | Valeur cible                                            |
| ----------------------------- | ------------------------------------ | ----------------------------- | ------------------------------------------------------- |
| MAILER_SUBJECTS_CONFIRMATION  | GOTRUE_MAILER_SUBJECTS_CONFIRMATION  | chaîne vide                   | Confirm your email address — Yokkai Collec’             |
| MAILER_SUBJECTS_RECOVERY      | GOTRUE_MAILER_SUBJECTS_RECOVERY      | chaîne vide                   | Reset your password — Yokkai Collec’                    |
| MAILER_TEMPLATES_CONFIRMATION | GOTRUE_MAILER_TEMPLATES_CONFIRMATION | chaîne vide                   | https://yokkai-collec.com/auth-emails/confirmation.html |
| MAILER_TEMPLATES_RECOVERY     | GOTRUE_MAILER_TEMPLATES_RECOVERY     | chaîne vide                   | https://yokkai-collec.com/auth-emails/recovery.html     |

Fichiers :

- `public/auth-emails/confirmation.html` et `public/auth-emails/recovery.html` : corps HTML complets de cette PR, à livrer dans l'image Next par un déploiement autorisé. Les anciennes versions françaises sont conservées dans Git au commit `e36e5a6b064cc0a3aefd619c89446327cb13ca59`. Elles n'étaient pas sélectionnées par GoTrue puisque les variables TEMPLATES étaient vides.
- `/data/coolify/services/gawq4yyxiise96wens0dt1ex/.env` : les quatre variables `MAILER_*` ci-dessus étaient présentes et vides. Conserver cet état pour le retour arrière, sans recopier les autres lignes ou secrets.
- `/data/coolify/services/gawq4yyxiise96wens0dt1ex/docker-compose.yml` : correspondances `GOTRUE_MAILER_*: '${MAILER_*}'` déjà en place ; aucune édition manuelle nécessaire. Passer par l'interface Coolify pour les variables, afin de ne pas perdre les modifications à sa prochaine régénération.

Après mise à disposition des HTML, Walid peut configurer ces quatre valeurs, puis recréer uniquement Auth via Coolify. Un simple restart ne recharge pas l'environnement Docker. GoTrue récupère les HTML par HTTP(S), pas par `file://`. Vérifier depuis Auth les deux réponses 200 et les marqueurs Go Template bruts, puis le contenu d'un email reçu dans chaque parcours ; aucun email n'a été envoyé pour cette vérification en lecture seule. Le cache GoTrue peut conserver un ancien modèle ou revenir au défaut anglais en cas d'échec de chargement.

Ne modifier ni `GOTRUE_SITE_URL`, ni `GOTRUE_URI_ALLOW_LIST`, ni les secrets SMTP/JWT/captcha. Les URLs d'authentification et Turnstile restent inchangées.

## Modèles non personnalisés

Confirmé dans le [code officiel GoTrue v2.196.0](https://github.com/supabase/auth/blob/v2.196.0/internal/mailer/templatemailer/templatemailer.go) : les sujets et corps par défaut d'invitation, magic link, changement d'adresse, réauthentification et notifications de sécurité sont déjà en anglais. Aucun modèle personnalisé de ces parcours n'est livré dans ce dépôt. Cela confirme les défauts amont, sans prétendre connaître les éventuelles personnalisations actives dans Coolify ; Walid doit vérifier que leurs variables SUBJECTS/TEMPLATES ne les remplacent pas.

## Retour arrière

Remettre les quatre variables Coolify MAILER_* à leur ancienne chaîne vide, recréer Auth, puis vérifier le retour aux modèles/sujets par défaut anglais sur un email réellement reçu. Si le code doit aussi revenir en arrière, restaurer les deux HTML au commit e36e5a6b064cc0a3aefd619c89446327cb13ca59 ; ils sont sans effet sur GoTrue tant que les variables TEMPLATES restent vides. Ne pas changer les liens d'authentification ou les paramètres de sécurité pour revenir aux textes précédents.
