# Messagerie privée — essai local

Le bouton **Message** apparaît à côté de **Remove** dans la liste des amis acceptés. Il ouvre une conversation texte privée, paginée, avec envoi par Entrée et retour à la ligne par Maj + Entrée. La fenêtre relit les messages toutes les cinq secondes quand l'onglet est visible et au retour au premier plan. Le brouillon et l'identifiant d'envoi sont conservés après un échec ; une nouvelle tentative ne crée pas de doublon.

## Essayer

Serveur de cette branche : `http://localhost:3002`.

- Démonstration sans connexion : `/design-system/private-messages-preview`.
- Choisir **View as**, cliquer **Message**, écrire, fermer et changer de joueur pour répondre. Deux onglets du même navigateur partagent l'historique de démonstration.
- **Add sample conversation** ajoute 55 messages pour tester la pagination.
- **Fail the next send** simule un échec unique pour vérifier le brouillon et sa nouvelle tentative.
- `/friends` utilise les RPC réelles avec une session de l'instance Supabase locale.

La page de démonstration n'envoie aucun message réel. Les RPC de messagerie sont vérifiées séparément avec trois comptes locaux jetables, supprimés après le test.

## Données et permissions

Migration : `20261019010000_private_messages.sql`. Appliquée uniquement à `supabase_db_Kara` en local, **pas au VPS**. La production n'est pas modifiée et cette branche ne doit pas être fusionnée pour cet essai.

- Aucun accès direct à la table pour `anon` ou `authenticated`, RLS activée ; deux RPC réservées à `authenticated`.
- L'auteur est toujours `auth.uid()`, jamais un identifiant fourni par le client.
- Lecture et envoi nécessitent une amitié acceptée et aucun blocage dans les deux sens ; bannissement et clôture de compte sont pris en compte.
- Les blocages et l'envoi partagent le verrou de la relation. L'envoi tient aussi les verrous de clôture des deux comptes.
- Messages texte de 1 à 2 000 caractères, affichés comme texte littéral ; une seconde entre envois et 30 messages maximum par minute pour un auteur, tous destinataires confondus.
- Historique paginé par date et UUID, 40 messages par page, borne serveur de 100.
- Suppression effective d'un compte Auth : suppression en cascade de ses messages envoyés et reçus.
- La mise à jour de `tests/security-definer-allowlist.mjs` ajoute uniquement les deux nouvelles RPC authentifiées avec justification ; validation de Walid à obtenir avant une future livraison SQL.

Avant une future livraison en production, finaliser les décisions de conservation/modération et l'inclusion des messages dans l'export des données personnelles. Cette itération reste un essai local.

## Vérifications ciblées

```powershell
node --test tests/private-messages-db.test.mjs tests/migration-security.test.mjs
node --env-file=.env.local scripts/prove-private-messages-local.mjs
node scripts/browser-proof-private-messages.mjs
```

Le script Supabase refuse toute URL autre que `http://localhost:54321` ou `http://127.0.0.1:54321`. Le script navigateur refuse un hôte distant et produit les captures dans `artifacts/private-messages/`.
