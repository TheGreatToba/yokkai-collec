# Succès : textes anglais

Migration : `20261015190000_english_achievement_texts.sql`. **Non appliquée au VPS.** Cette PR ne doit pas être mergée ou appliquée sans la décision de Walid ; aucune intervention de production n'a été effectuée.

Les onze définitions existantes de `public.achievements` reçoivent uniquement un nouveau `titre` et une nouvelle `description`. IDs, conditions, catégories et récompenses restent identiques. Les tables joueurs, notifications et catalogue ne sont pas modifiées ; les notifications affichent le titre de la définition par jointure existante. Aucune fonction SQL ni route ne change. Les nouvelles fonctions ou les futurs succès UR relèvent des PR d'Abdou, hors périmètre ici.

La migration est idempotente : une définition déjà traduite ne déclenche aucune mise à jour supplémentaire. À l'application, les libellés des onze IDs remplacent les libellés existants : vérifier les éventuels changements concurrents avant déploiement.

## Libellés proposés

| ID technique conservé | Titre                  | Description                                       |
| --------------------- | ---------------------- | ------------------------------------------------- |
| premier-rituel        | First Ritual           | Open your first Regular Pack.                     |
| habitude-installe     | Getting into the Habit | Open 10 Regular Packs.                            |
| chasseur-yokkai       | Yokkai Hunter          | Open 50 Regular Packs.                            |
| decision-decisive     | Decisive Choice        | Complete your first Decision Pack.                |
| collection-en-marche  | Collection in Motion   | Collect 25 different cards from the catalog.      |
| legende-naissante     | A Legend Begins        | Collect your first LR card.                       |
| eclat-inattendu       | Unexpected Sparkle     | Collect your first Shiny card.                    |
| specialiste           | Specialist             | Collect 50% of any category.                      |
| adjuge                | Going, Going, Gone!    | Win your first auction.                           |
| marche-conclu         | Deal Done              | Complete your first accepted trade.               |
| transcendance         | Transcendence          | Evolve an SSR card into Shiny for the first time. |

## Validation

Le test de migration utilise une base jetable en CI GitHub : conservation des conditions et récompenses, des lignes joueurs et notifications, réapplication idempotente, puis retour arrière. Aucun test existant de règle produit n'est affaibli.

## Retour arrière manuel

À faire uniquement sur décision de Walid, après sauvegarde des onze libellés courants et revue des changements intervenus depuis cette PR. Le SQL ci-dessous restaure seulement les définitions qui correspondent encore exactement aux textes anglais livrés ; les libellés modifiés ensuite restent intacts. Il est idempotent. Il ne retire pas l'entrée de la migration du registre ; un retour durable doit être enregistré dans une nouvelle migration, sans modifier l'historique.

```sql
begin;

update public.achievements as achievement
set titre = translation.old_title, description = translation.old_description
from (values
  ('premier-rituel', 'Premier rituel', 'Ouvrir son premier Regular Pack.', 'First Ritual', 'Open your first Regular Pack.'),
  ('habitude-installe', 'L''habitude s''installe', 'Ouvrir 10 Regular Packs.', 'Getting into the Habit', 'Open 10 Regular Packs.'),
  ('chasseur-yokkai', 'Chasseur de Yokkai', 'Ouvrir 50 Regular Packs.', 'Yokkai Hunter', 'Open 50 Regular Packs.'),
  ('decision-decisive', 'Décision décisive', 'Finaliser son premier Decision Pack.', 'Decisive Choice', 'Complete your first Decision Pack.'),
  ('collection-en-marche', 'Collection en marche', 'Réunir 25 cartes différentes du catalogue.', 'Collection in Motion', 'Collect 25 different cards from the catalog.'),
  ('legende-naissante', 'Légende naissante', 'Obtenir sa première carte LR.', 'A Legend Begins', 'Collect your first LR card.'),
  ('eclat-inattendu', 'Éclat inattendu', 'Obtenir sa première carte Shiny.', 'Unexpected Sparkle', 'Collect your first Shiny card.'),
  ('specialiste', 'Spécialiste', 'Compléter 50 % de n''importe quelle catégorie.', 'Specialist', 'Collect 50% of any category.'),
  ('adjuge', 'Adjugé !', 'Gagner sa première enchère.', 'Going, Going, Gone!', 'Win your first auction.'),
  ('marche-conclu', 'Marché conclu', 'Réaliser son premier échange accepté.', 'Deal Done', 'Complete your first accepted trade.'),
  ('transcendance', 'Transcendance', 'Faire évoluer une première carte SSR en Shiny.', 'Transcendence', 'Evolve an SSR card into Shiny for the first time.')
) as translation(id, old_title, old_description, english_title, english_description)
where achievement.id = translation.id
  and achievement.titre = translation.english_title
  and achievement.description = translation.english_description;

commit;
```
