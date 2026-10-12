# Vérification locale avant merge

`npm run verify` remplace le contrôle GitHub Actions pour les merges. Mettre la branche à jour avec `origin/master`, commiter, puis lancer la commande sur un commit propre. Coller le résumé et les SHA dans la description de la PR ; aucune modification ni nouveau master ne doit intervenir entre ce contrôle et le merge.

La commande exécute audit prod (high), lint, TypeScript, format, tous les tests suivis par Git, build production, contrôle des routes design-system, puis le test existant de rejeu complet des migrations sur base vierge avec droits Supabase par défaut, SECURITY DEFINER et unicité des numéros. Le test de migration-security est exécuté une fois dans sa phase dédiée, sans être doublé dans la suite complète. Les fichiers locaux non suivis ne sont ni exécutés ni modifiés.

Le build reçoit uniquement une configuration publique factice, sans session joueur. Sur Windows, Next.js utilise Webpack pour le build de production (la version installée de Turbopack a un problème local de chargement des polices) ; sur Linux, le build habituel reste utilisé. Aucun fichier de police ou de configuration produit n’est changé.

Si Docker local répond, le script existant crée un conteneur PostgreSQL17.6.1.136 jetable sans port exposé et y rejoue toutes les migrations sous postgres NOSUPERUSER, puis exécute les50 surenchères croisées et les tests de clôture des écritures lors d’une suppression. Il retire seulement ce conteneur à la fin. Docker distant est refusé. Si Docker est absent/inaccessible : avertissement explicite « PostgreSQL17 et concurrence NON EXECUTES » et résumé « OK AVEC AVERTISSEMENT DOCKER » ; le test n’est jamais annoncé réussi. Avec Docker disponible, toute erreur échoue le verify.

Le hook pre-push conserve le refus de master et lance `npm run verify:quick` : lint, tsc, format et tests unitaires suivis. Les tests utilisant PGlite/rejeu/bootstrap SQL et les fichiers -db sont réservés au verify complet. Ce filtre conservateur peut réserver aussi quelques contrats textuels à la suite complète ; aucun test n’est supprimé ou ignoré dans verify.

Les alias `npm run ci` (checks complets) et `npm run ci:db` (PostgreSQL requis) restent disponibles ; `ci:all` appelle verify. Les workflows sont conservés sous `.github/`, avec workflow_dispatch uniquement. Leur structure complète est préservée pour que le contrat existant de #176 reste vert ; aucune assertion n’est abaissée, aucun trigger automatique réactivé.
