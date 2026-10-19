# Messagerie privée — essai local

Le bouton **Message** apparaît à côté de **Remove** dans la liste des amis acceptés. Il ouvre une conversation texte privée, paginée, avec envoi par Entrée et retour à la ligne par Maj + Entrée. La fenêtre relit les messages toutes les cinq secondes quand l'onglet est visible et au retour au premier plan. Le brouillon et l'identifiant d'envoi sont conservés après un échec ; une nouvelle tentative ne crée pas de doublon.

## Essayer

Serveur de cette branche : `http://localhost:3002`.

Démarrage : `node scripts/start-private-messages-local.mjs`. Le script vérifie que Supabase pointe uniquement vers la boucle locale et reprend seulement la clé publique GIPHY du checkout principal si elle manque dans le worktree. Aucun identifiant de base de production n'est repris.

- Démonstration sans connexion : `/design-system/private-messages-preview`.
- Choisir **View as**, cliquer **Message**, écrire, fermer et changer de joueur pour répondre. Deux onglets du même navigateur partagent l'historique de démonstration.
- **Add sample conversation** ajoute 55 messages pour tester la pagination.
- **Fail the next send** simule un échec unique pour vérifier le brouillon et sa nouvelle tentative.
- `/friends` utilise les RPC réelles avec une session de l'instance Supabase locale.
- **GIF** ouvre le sélecteur GIPHY du marché. Le GIF choisi reste dans le brouillon jusqu'à **Send message**, avec ou sans texte, et peut être retiré avant envoi. Aucun import de galerie ou fichier personnel.
- **Trade** ouvre le panneau d'échanges existant dans une modale, avec l'ami de la conversation verrouillé comme destinataire : aucun sélecteur d'amis et uniquement l'historique de cette relation. La page Trades classique garde le choix libre des amis. La démonstration utilise un adaptateur fictif qui interdit l'envoi d'offres réelles ; `/friends` garde les permissions et les opérations du système d'échanges existant.

La page de démonstration n'envoie aucun message réel. Les RPC de messagerie sont vérifiées séparément avec trois comptes locaux jetables, supprimés après le test.

## Données et permissions

Migration : `20261019010000_private_messages.sql`. Appliquée uniquement à `supabase_db_Kara` en local, **pas au VPS**. La production n'est pas modifiée et cette branche ne doit pas être fusionnée pour cet essai.

Migration complémentaire : `20261019010001_private_message_gifs.sql`, également appliquée uniquement au conteneur local. Ajoute `gif_url`, conserve l'ancienne API texte et ajoute une RPC GIF authentifiée. Aucun bucket ou droit de stockage supplémentaire.

- Aucun accès direct à la table pour `anon` ou `authenticated`, RLS activée ; trois RPC réservées à `authenticated` (lecture, texte, texte/GIF).
- L'auteur est toujours `auth.uid()`, jamais un identifiant fourni par le client.
- Lecture et envoi nécessitent une amitié acceptée et aucun blocage dans les deux sens ; bannissement et clôture de compte sont pris en compte.
- Les blocages et l'envoi partagent le verrou de la relation. L'envoi tient aussi les verrous de clôture des deux comptes.
- Messages texte de 1 à 2 000 caractères, affichés comme texte littéral ; une seconde entre envois et 30 messages maximum par minute pour un auteur, tous destinataires confondus.
- Les messages GIF peuvent avoir une légende vide. Seules les URL GIF HTTPS des domaines médias GIPHY exacts sont acceptées côté SQL et interface : pas d'URL arbitraire, `data:`, `blob:`, SVG ou hôte ressemblant. Texte et GIF partagent les mêmes verrous, limites et identifiants de nouvelle tentative.
- Historique paginé par date et UUID, 40 messages par page, borne serveur de 100.
- Suppression effective d'un compte Auth : suppression en cascade de ses messages envoyés et reçus.
- La mise à jour de `tests/security-definer-allowlist.mjs` ajoute uniquement les deux nouvelles RPC authentifiées avec justification ; validation de Walid à obtenir avant une future livraison SQL.

L'extension GIF ajoute la troisième signature exacte authentifiée `send_private_message_gif(uuid,text,uuid,text)`, sans élargir les rôles des fonctions existantes. L'utilisateur a confirmé prévenir Walid pour la validation avant une future livraison. Le composant `Modal` isole Annuler/Échap et le piège Tab d'une sous-modale, sans modifier les assertions existantes ; le parcours navigateur vérifie le retour au fil de discussion après le sélecteur GIF.

Avant une future livraison en production, finaliser les décisions de conservation/modération et l'inclusion des messages dans l'export des données personnelles. Cette itération reste un essai local.

## Vérifications ciblées

```powershell
node --test tests/private-messages-db.test.mjs tests/private-message-gifs-db.test.mjs tests/migration-security.test.mjs
node --env-file=.env.local scripts/prove-private-messages-local.mjs
node scripts/browser-proof-private-messages.mjs
```

Le script Supabase refuse toute URL autre que `http://localhost:54321` ou `http://127.0.0.1:54321`. Le script navigateur refuse un hôte distant et produit les captures dans `artifacts/private-messages/`.
