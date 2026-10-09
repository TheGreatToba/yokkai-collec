# À planifier

- Ajouter un job CI qui rejoue les migrations sur une vraie image PostgreSQL 17 identique à la prod (ex. image Supabase postgres en service container). Le rejeu actuel utilise PostgreSQL 18.3 via PGlite, contre PostgreSQL 17.6 en production.
- Un changement de domaine Supabase impose une migration de mise à jour de la liste des origines autorisées pour les avatars : le domaine est défini en dur dans `public.update_profile`, depuis `20261009000007_validate_profile_avatar.sql`. Coordonner cette migration avec le changement de domaine pour préserver l'envoi des avatars ; ne pas modifier la migration historique.
