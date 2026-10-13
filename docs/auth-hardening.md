# Durcissement Auth — déploiement manuel

Cette procédure est un livrable de configuration, pas une application des réglages. La PR A ajoute le parcours e-mail et les modèles ; les PR C (IP) et B (Turnstile) seront indépendantes et nécessitent chacune un accord. Aucun compte existant ne doit être modifié, supprimé ou rétroactivement « vérifié ».

## Inventaire du 13 octobre 2026

Chaîne inspectée : Cloudflare → Traefik 3.6 → Envoy 1.39.1 → GoTrue 2.196.0. L’API est proxifiée par Cloudflare, mais une requête de lecture directe vers l’origine reçoit une réponse Envoy : l’origine ne bloque pas les connexions hors Cloudflare. Envoy et Auth ne publient pas directement leurs ports sur l’hôte.

Dans le modèle et le fichier actif Envoy : use_remote_address=true, xff_num_trusted_hops absent (défaut 0), route /auth/v1/ vers Auth avec suppression du préfixe. Aucun mécanisme identifié de normalisation de CF-Connecting-IP ou de suppression de Sb-Forwarded-For. Les filtres Lua traitent les clés API. Traefik n’a pas de trustedIPs explicites dans ses arguments inspectés. L’adresse distante d’Envoy représente son pair Traefik ; les valeurs effectivement reçues par GoTrue restent à mesurer sur une requête bornée, sans journaliser de jetons.

Next utilise l’API publique ; Next et Envoy sont sur des réseaux Docker différents. @supabase/ssr 0.12.7 et supabase-js 2.117.1 sont installés. Le nom de cookie par défaut est sb-api-auth-token : tout changement d’URL serveur devra conserver ce nom explicitement côté navigateur, serveur et proxy de renouvellement.

L’environnement Auth inspecté définit autoconfirm=true et une liste de redirections avec /**. Les variables de limiteur d’IP, captcha, minimum de mot de passe et HIBP ne sont pas explicitement définies. Les défauts documentés pour cette version sont : minimum 6, quota d’e-mails 30/h, délai par adresse 60 s, expiration des liens 86400 s. Un comptage READ ONLY/ROLLBACK donne 50 utilisateurs, dont zéro compte avec e-mail non vide sans email_confirmed_at. Ce champ a pu être rempli par autoconfirm : il ne prouve pas la possession de la boîte mail.

SMTP utilise le relais OVH et le port 587. L’offre commerciale et le budget partagé avec d’autres applications ne sont pas identifiables par ces seuls paramètres. SPF existe ; DMARC n’a pas été trouvé ; DKIM et livraison réelle restent à vérifier. Ne jamais recopier les identifiants SMTP, clés, tokens, valeurs sensibles ou accès VPS dans ce document, un ticket ou une PR.

## Règles d’application et de retour arrière

Déployer le code avant toute activation ; une variable à la fois. Pour chaque variable Auth, vérifier la correspondance entre Coolify, le compose et l’environnement du conteneur : une variable de Coolify non injectée ou masquée ne change rien. Recréer/redémarrer uniquement Auth avec la même image épinglée, vérifier /health en interne puis le parcours concerné avant la variable suivante. Un simple restart d’un conteneur ne recharge pas une modification de son environnement Docker.

Conserver les anciennes valeurs dans le gestionnaire sécurisé d’exploitation, sans export d’environnement complet. « Retirer la surcharge » signifie restaurer l’absence constatée, après vérification des autres sources de configuration ; ce n’est pas écrire une chaîne vide. Aucun changement de version Auth n’est inclus : son démarrage peut appliquer des migrations intégrées si l’image change.

Pendant chaque redémarrage, inscription, connexion, renvoi, récupération et renouvellement peuvent échouer temporairement. Les JWT existants peuvent continuer à servir certains appels, mais les pages qui interrogent Auth peuvent échouer. Prévoir une courte fenêtre annoncée, attendre la santé du service et proposer de réessayer. Les compteurs en mémoire peuvent repartir à zéro après redémarrage ; ne pas multiplier les instances pour contourner les quotas.

## 1. DKIM, puis DMARC, puis livraison réelle

1. Identifier l’offre et le domaine expéditeur dans OVH. Activer DKIM selon cette offre ; publier exactement le sélecteur et la clé publique TXT/CNAME fournis par OVH, sans inventer de sélecteur. Les enregistrements mail/DKIM sont DNS only. Vérifier la résolution, puis la signature DKIM alignée dans un e-mail reçu. Retour arrière : restaurer l’enregistrement précédent et le réglage OVH ; tenir compte du TTL.
2. Conserver SPF actuel : TXT à la racine, valeur v=spf1 include:mx.ovh.com -all. Ne pas créer un second SPF ni autoriser des services non utilisés. À revérifier si le fournisseur change.
3. Publier TXT _dmarc : v=DMARC1; p=none; adkim=r; aspf=r; pct=100. Aucun destinataire de rapports n’est inventé : ajouter rua seulement après choix d’une boîte contrôlée et vérification des autorisations nécessaires. Vérifier absence de doublon et résolution. Retour arrière : supprimer le nouveau TXT ou restaurer l’ancien. Ne pas passer à quarantine/reject avant validation des expéditeurs légitimes.
4. Envoyer un e-mail réel borné via le chemin Auth vers une boîte contrôlée ; confirmer réception, DKIM/SPF alignés et dmarc=pass dans les en-têtes du destinataire, pas seulement une acceptation SMTP. Si cela échoue, ne pas activer la confirmation obligatoire. Le test de livraison sera une opération distincte autorisée, pas une rafale.

## 2. Déployer PR A et fournir les modèles

PR A fonctionne avec autoconfirm=true (session et entrée immédiate) et false (écran « Vérifie ta boîte mail » sans session). Aucun drapeau applicatif ne force une confirmation fictive. Le renvoi utilise Auth resend de type signup, jamais une nouvelle inscription. Compte absent ou déjà confirmé : réponse neutre. Le compteur de 60 secondes dans l’interface est une aide, pas une barrière de sécurité ; GoTrue reste responsable du délai réel, y compris pour l’API directe.

Les modèles sont livrés dans public/auth-emails/confirmation.html et public/auth-emails/recovery.html. Après déploiement, GoTrue 2.196.0 les récupère par HTTP(S), avec les variables MAILER_TEMPLATES ci-dessous. Il ne lit pas ces variables comme des chemins file://. Vérifier un GET HTTP 200 sans session depuis Auth et la présence des marqueurs Go Template non interpolés. Le cache peut conserver une ancienne version ou retomber sur le modèle par défaut en cas d’échec : vérifier le contenu de l’e-mail réellement reçu. Le déploiement doit inclure public dans l’image du site.

| Variable Coolify injectée dans Auth  | Valeur proposée                                                                                                | Retour arrière                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| GOTRUE_SITE_URL                      | https://yokkai-collec.com (sans slash final pour les modèles)                                                  | Valeur précédente conservée hors dépôt          |
| GOTRUE_URI_ALLOW_LIST                | https://yokkai-collec.com/auth/confirm,https://yokkai-collec.com/auth/confirm?next=/reinitialiser-mot-de-passe | Ancienne liste conservée hors dépôt             |
| GOTRUE_MAILER_TEMPLATES_CONFIRMATION | https://yokkai-collec.com/auth-emails/confirmation.html                                                        | Ancienne valeur ; retirer si auparavant absente |
| GOTRUE_MAILER_TEMPLATES_RECOVERY     | https://yokkai-collec.com/auth-emails/recovery.html                                                            | Ancienne valeur ; retirer si auparavant absente |
| GOTRUE_MAILER_SUBJECTS_CONFIRMATION  | Confirme ton adresse e-mail — Yokkai Collec’                                                                   | Ancienne valeur ; retirer si auparavant absente |
| GOTRUE_MAILER_SUBJECTS_RECOVERY      | Réinitialise ton mot de passe — Yokkai Collec’                                                                 | Ancienne valeur ; retirer si auparavant absente |

NEXT_PUBLIC_SITE_URL doit correspondre à l’origine HTTPS canonique. Ne pas changer les secrets SMTP, les clés API ou les clés JWT. Conserver les chemins de vérification API existants ; les nouveaux modèles dirigent vers /auth/confirm avec token_hash et type=signup ou recovery. La route accepte également les anciens liens PKCE, ignore les destinations next externes et retire les tokens de la redirection finale. Le type recovery mène au formulaire de nouveau mot de passe. Un lien consommé et un lien expiré partagent le code otp_expired : l’interface ne prétend pas pouvoir les différencier. Un échec temporaire d’Auth affiche une indisponibilité séparée.

Les modèles n’annoncent pas une durée fixe, pour rester compatibles avec le réglage courant et la durée cible. Ils précisent l’usage unique et invitent à utiliser le dernier message. Désactiver le suivi/réécriture de liens. Vérifier un lien ouvert sur un autre navigateur avec token_hash et l’effet des scanners de messagerie ; ceux qui consomment le lien nécessitent une décision de parcours dédiée avant activation.

Attention : GoTrue autorise également des redirections partageant l’hôte de SITE_URL ; URI_ALLOW_LIST n’est pas une restriction absolue aux deux chemins. Tester un hôte externe refusé ; ne pas autoriser de domaines de prévisualisation ni localhost en production.

## 3. Quotas et mots de passe

Confirmer l’offre OVH avant de choisir le budget. Pour MX Plan, OVH annonce environ 200 e-mails/h par compte et 300/h par IP source. Proposition de lancement : 150/h pour Auth, seulement si ces limites correspondent à l’offre et si le budget des autres envois laisse cette marge. Pour une autre offre, documenter son quota contractuel et conserver au moins 25 % de marge après les envois partagés. Ne pas utiliser 150 comme quota universel OVH.

| Variable Coolify injectée dans Auth | Valeur proposée                                   | Retour arrière                                              |
| ----------------------------------- | ------------------------------------------------- | ----------------------------------------------------------- |
| GOTRUE_RATE_LIMIT_EMAIL_SENT        | 150, conditionnel à la confirmation OVH ci-dessus | Retirer la surcharge si auparavant absente (défaut 30/h)    |
| GOTRUE_SMTP_MAX_FREQUENCY           | 60s (format time.Duration de cette version)       | Retirer la surcharge si auparavant absente (défaut 60 s)    |
| GOTRUE_MAILER_OTP_EXP               | 3600                                              | Retirer la surcharge si auparavant absente (défaut 86400 s) |
| GOTRUE_PASSWORD_MIN_LENGTH          | 8                                                 | Retirer la surcharge si auparavant absente (défaut 6)       |
| GOTRUE_PASSWORD_HIBP_ENABLED        | true                                              | false, ou retirer la surcharge si auparavant absente        |
| GOTRUE_PASSWORD_HIBP_FAIL_CLOSED    | false                                             | Ancienne valeur ; retirer si auparavant absente             |

Vérifier chaque variable et redémarrage séparément. Contrôler minimum et mot de passe de test compromis par les parcours applicatif et direct, sans inscription réussie supplémentaire. Si HIBP est inaccessible, fail_closed=false laisse passer le mot de passe : aucun blocage général ni promesse de contrôle systématique dans ce cas. Ne pas changer les mots de passe existants.

Dans GoTrue 2.196.0, le budget global d’e-mails non nul n’est appliqué que si autoconfirm=false. Il ne protège donc pas encore les envois à cette étape ; la bascule suivante est nécessaire. Ce comportement est à recontrôler lors d’une mise à jour d’Auth. Ne pas essayer d’épuiser les budgets de production pour le prouver.

L’interface distingue le quota global, le délai par adresse et l’indisponibilité de l’envoi. GoTrue réutilise over_email_send_rate_limit pour les deux limites : le message fixe de fréquence est reconnu, sans afficher le texte fournisseur. Les erreurs génériques de base de données restent des erreurs Auth, pas de faux diagnostics SMTP. Une réponse SMTP acceptée ne garantit pas la livraison ; un refus SMTP peut être présenté comme erreur d’envoi, sans son détail technique.

## 4. Confirmation obligatoire

| Variable Auth                                 | Valeur proposée                               | Retour arrière                                                  |
| --------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------- |
| GOTRUE_MAILER_AUTOCONFIRM                     | false                                         | true                                                            |
| GOTRUE_MAILER_ALLOW_UNVERIFIED_EMAIL_SIGN_INS | false (vérifier qu’aucune source ne l’active) | Ancienne valeur sûre, sans autoriser de connexion non confirmée |

Activer seulement après DKIM, DMARC, livraison réelle et PR A déployée. Avec un des deux comptes jetables autorisés, vérifier absence de session avant confirmation, refus de connexion, renvoi, confirmation et connexion. Ne pas demander de confirmation rétroactive aux 50 comptes de l’inventaire. Revenir à true ne confirme pas automatiquement tous les comptes créés entre-temps : conserver leur parcours de renvoi. Le retour arrière réouvre le risque de faux comptes et désactive le budget global non nul de cette version.

## 5. PR C, confiance réseau et limiteur d’IP — à finaliser dans PR C

Recommandation : un chemin interne Next → Envoy, avec connexion Docker restreinte/dédiée et nom de cookie sb-api-auth-token conservé. Le navigateur garde l’URL publique. L’URL interne doit être optionnelle pour permettre le déploiement du code avant la configuration. Aucun partage réseau n’est appliqué par PR A.

Le préalable est de fermer le contournement de Cloudflare sur les entrées web du site ET de l’API. Traefik doit accepter les en-têtes d’origine seulement de pairs Cloudflare authentifiés/autorisé(s), normaliser une IP unique et écraser les en-têtes internes apportés par un client. Envoy voit Traefik : recopier CF-Connecting-IP sans cette preuve n’est pas sûr. Séparer l’entrée interne serveur et l’entrée publique ; supprimer Sb-Forwarded-For fourni publiquement. N’ajouter des trusted hops que pour une chaîne mesurée et de longueur contrôlée.

Cible à confirmer par PR C : SUPABASE_INTERNAL_URL côté serveur seulement et GOTRUE_RATE_LIMIT_HEADER=X-Auth-Client-IP. La valeur finale de l’URL, les règles d’injection Envoy et les débits seront documentés après vérification du chemin retenu. Ne pas activer GOTRUE_SECURITY_SB_FORWARDED_FOR_ENABLED en parallèle sans règle de confiance démontrée ; une clé publique n’authentifie pas l’en-tête. Le client Auth doit conserver une clé publique et ne pas recevoir un rôle administratif qui pourrait contourner le captcha.

Déployer PR C puis établir la confiance, vérifier deux IP de joueurs distinctes sur appels directs et Server Actions, vérifier refus/écrasement d’une IP falsifiée et absence de compteur partagé, enfin activer le limiteur. Retour arrière : restaurer les variables et règles précédentes ; aucune transmission d’IP non fiable ne doit rester active. Pas de rafale pour saturer un compteur de production.

## 6. PR B, puis Turnstile dans Auth — à finaliser dans PR B

| Variable                                            | Valeur cible                                                             | Retour arrière                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| NEXT_PUBLIC_TURNSTILE_SITE_KEY (site, build public) | Clé publique du widget pour les domaines autorisés, à fournir hors dépôt | Retirer la variable et reconstruire le site          |
| GOTRUE_SECURITY_CAPTCHA_PROVIDER                    | turnstile                                                                | Ancienne valeur ; retirer si auparavant absente      |
| GOTRUE_SECURITY_CAPTCHA_SECRET                      | Secret du widget conservé uniquement dans Coolify                        | Ancien secret conservé dans le gestionnaire sécurisé |
| GOTRUE_SECURITY_CAPTCHA_ENABLED                     | true, en dernier                                                         | false                                                |

Déployer PR B avant activation Auth. Le widget n’apparaît que si la clé publique est définie ; le jeton n’est transmis que dans ce cas. Tester inscription, connexion, récupération, renvoi et revérification du mot de passe actuel. Un jeton expiré, consommé ou potentiellement consommé après incident réseau doit être renouvelé, jamais réutilisé. Tester clavier/lecteur d’écran et assistance humaine sans route publique de contournement. Ajouter challenges.cloudflare.com à script-src et frame-src dans la CSP de signalement ; ne pas passer à une CSP bloquante.

Désactiver CAPTCHA_ENABLED avant tout retrait du widget en retour arrière. Des requêtes sans jeton sur l’API directe doivent être refusées après activation. Confirmer ce comportement pour resend sur la version déployée ; ne pas présumer que tous les fournisseurs OAuth utilisent ces mêmes contrôles.

## Vérifications bornées et conditions d’arrêt

Deux comptes jetables au maximum, deux boîtes contrôlées, idéalement deux réseaux. Aucun essai d’inscription en masse, aucune rafale, aucun épuisement de quota SMTP/Auth sans accord distinct. Les tests locaux utilisent des réponses simulées et aucune clé/session de production.

Avec accord pour les essais de production : une inscription/confirmation par compte, un renvoi prématuré et un renvoi après délai, une récupération, un réemploi de lien, un lien invalide, une redirection externe, et des essais négatifs limités côté API directe. Ne pas modifier les comptes existants. Prévoir un nettoyage des comptes jetables seulement après autorisation de cette opération.

Arrêter la bascule si livraison non démontrée, réseau de confiance incomplet, jeton captcha non traité dans un parcours ou quota OVH non confirmé. Vérifier disponibilité Auth après chaque étape et conserver les valeurs de retour arrière hors dépôt. Aucun accès SSH ni secret ne doit figurer dans les comptes rendus.

## Sources vérifiées

- [GoTrue 2.196.0 : configuration](https://github.com/supabase/auth/blob/v2.196.0/internal/conf/configuration.go)
- [GoTrue : envois, fréquence et budget conditionné par autoconfirm](https://github.com/supabase/auth/blob/v2.196.0/internal/api/mail.go)
- [GoTrue : modèles récupérés par HTTP et cache](https://github.com/supabase/auth/blob/v2.196.0/internal/mailer/templatemailer/template.go)
- [GoTrue : renvoi neutre](https://github.com/supabase/auth/blob/v2.196.0/internal/api/resend.go)
- [Envoy 1.39.1 : en-têtes et confiance XFF](https://www.envoyproxy.io/docs/envoy/v1.39.1/configuration/http/http_conn_man/headers)
- [OVH : limites SMTP, à confronter à l’offre réelle](https://github.com/ovh/ovhcloud-docs/blob/develop/docs/en/guides/web-cloud/web-hosting/email-sending-best-practices.mdx)
