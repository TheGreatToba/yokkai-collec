# Conditions d'utilisation : brouillon à valider

La route publique `/terms` est un **brouillon non applicable**, lié depuis le footer
partagé. Elle porte un avertissement visible et `robots.index = false`. Cette PR
ne doit pas être fusionnée pour publication tant que les points ci-dessous ne sont
pas résolus. Aucun déploiement n'est inclus dans cette tâche.

## Informations confirmées

- Marque : Yokkai Collec'.
- Contact communiqué par le propriétaire : `yokkaicollec@gmail.com`.
- Le produit n'est pas réservé aux adultes.
- Texte destiné aux joueurs entièrement en anglais.

## Avant publication

- Confirmer le **nom légal de l'éditeur** (personne ou société), sa qualité et les
  autres mentions obligatoires selon son statut et sa juridiction. Ne pas inventer
  d'identité, d'adresse, de tribunal compétent ou de numéro d'immatriculation.
- Faire relire le texte par un juriste, notamment l'accès des mineurs, les achats
  Pro, les droits des consommateurs, les images de tiers et les contenus joueurs.
- Déterminer les exigences d'âge, de capacité contractuelle et d'autorisation
  parentale applicables aux territoires desservis. Le brouillon n'impose pas
  d'interdiction générale des mineurs ni de seuil mondial arbitraire.
- Vérifier les mécanismes nécessaires : information adaptée à l'âge, vérification
  proportionnée, autorisation parentale si requise et éventuels parcours d'achat
  spécifiques. **Une clause de CGU ne remplace pas ces mécanismes.** Cette PR
  ne met en œuvre ni vérification d'âge ni accord parental. La case d'inscription
  n'est pas un consentement RGPD ou une autorisation parentale.
- Préparer/valider l'information relative à la vie privée et aux traitements de
  données : ces conditions ne sont pas une politique de confidentialité. Aucun
  lien vers une route `/privacy` inexistante n'est ajouté.
- Valider l'étendue de la licence nécessaire aux contenus utilisateurs et la
  procédure de signalement/modération des droits de tiers.
- Confirmer que les informations et consentements de paiement, de renouvellement
  et de rétractation sont bien présentés dans le parcours réel de souscription.
  Aucune exclusion générale des remboursements ni renonciation automatique aux
  droits légaux n'est introduite.
- Après validation, renseigner l'identité de l'éditeur et la date d'entrée en
  vigueur ; retirer l'avertissement de brouillon et décider de l'indexation dans
  une modification revue séparément. Les tests protégeant le statut de brouillon
  devront être adaptés séparément conformément au workflow d'équipe.

## Sources de préparation

- [WikiMasters — Conditions](https://www.wiki-masters.com/terms) : inspiration de
  structure uniquement. Ni son interdiction des moins de 18 ans, ni ses conditions
  de licence, de paiement ou ses textes ne sont repris.
- [CNIL — capacité d'agir des mineurs](https://cnil.fr/fr/recommandation-1-encadrer-la-capacite-dagir-des-mineurs-en-ligne).
- [CNIL — consentement parental](https://cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans) :
  le seuil français de 15 ans concerne certains traitements en ligne fondés sur
  le consentement, pas une interdiction générale d'accès à tout service.
- [CNIL — vérification de l'âge et de l'accord parental](https://cnil.fr/fr/recommandation-7-verifier-lage-de-lenfant-et-laccord-des-parents-dans-le-respect-de-sa-vie-privee).
- [Union européenne — achats à distance](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm).
- [Union européenne — rétractation et remboursements](https://europa.eu/youreurope/citizens/consumers/shopping/returns/index_en.htm).

Ces ressources ne remplacent pas un avis juridique adapté au service.

## Périmètre technique

- Nouvelle page serveur, même présentation et footer que les pages d'information.
- Nouveau lien dans la navigation du footer commun.
- Fond bleu nuit `#060913` sur cette page uniquement (encadré et footer assortis),
  via une variante optionnelle du composant d'information ; les autres pages
  gardent leur thème existant.
- Ajoute à l'inscription une case obligatoire conditions/règles, décochée au
  départ, contrôlée par la Server Action avant tout appel Supabase. Les liens
  s'ouvrent dans un nouvel onglet pour préserver le formulaire.
- Pseudos : les emojis sont refusés par la validation partagée, le pattern HTML,
  la Server Action et la vérification de disponibilité. Les comptes existants ne
  sont pas renommés et leur connexion reste possible. Les accents, espaces,
  nombres et écritures non latines restent autorisés.
- La version `2026-10-20-draft` et l'heure calculée par le serveur sont transmises
  en métadonnées Auth `signup_policies`. Ces métadonnées sont modifiables par leur
  propriétaire : ce n'est **pas** un registre de preuve immuable.
- Périmètre : contrôle des parcours d'inscription du site, pas du point d'entrée
  Auth direct. Une inscription directe à l'API Supabase ne passe pas par la Server
  Action ; aucun nouveau trigger SQL n'est ajouté. Un durcissement global de l'API
  et un registre de preuve nécessiteraient une évolution serveur/SQL séparée,
  revue et coordonnée. Ne pas présenter cette PR comme une garantie de conformité.
- Aucun changement des limites d'âge techniques ou des achats.
- Avant production : valider/publier les textes, puis versionner explicitement
  leur acceptation ; la note du formulaire indique le statut de prévisualisation.
- Aucun test existant assoupli ; nouveaux tests dédiés au brouillon.
- **Aucune migration Supabase. Aucune migration appliquée au VPS.**
