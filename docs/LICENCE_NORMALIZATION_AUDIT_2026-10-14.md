# Audit des licences — 14 octobre 2026

## Périmètre

L'audit a été exécuté en lecture seule sur la base de production. Il couvre les
licences visibles des cartes (`cards.franchise`), toutes les licences principales
et secondaires du Classeur (`card_franchises`) et les classeurs favoris
(`panini_album_favorites`).

- 5 604 licences distinctes dans le Classeur ;
- 5 500 licences distinctes associées à la catégorie `ANIME/MANGA` ;
- 51 alias sûrs détectés, représentant 187 associations carte/licence à fusionner.

## Fractionnement confirmé

La famille Noragami était répartie entre trois classeurs :

| Alias              | Cartes en production | Licence cible |
| ------------------ | -------------------: | ------------- |
| `Noragami`         |                   19 | `Noragami`    |
| `Noragami Aragoto` |                   24 | `Noragami`    |
| `Noragami OVA`     |                    1 | `Noragami`    |

Les trois variantes sont désormais normalisées vers `Noragami` par la migration.

L'audit a également confirmé des variantes bonus du type `OVA`, `OAD`, `ONA`,
`Special`, `Specials` et `Special Episodes`, notamment pour `Attack on Titan`,
`Golden Kamuy`, `Fullmetal Alchemist Brotherhood` et `MUSHI-SHI`.

## Règles appliquées

La normalisation regroupe :

- `Noragami Aragoto` et toutes les variantes Noragami dans `Noragami` ;
- les saisons, cours et parties numérotées déjà prises en charge ;
- les films des familles explicitement auditées, dont One Piece et Naruto ;
- un suffixe `OVA`, `OAD`, `ONA` ou `Special` uniquement si la licence parente
  exacte existe déjà dans la base.

La dernière condition est volontaire : elle évite de transformer des titres
réels comme `A Returner's Magic Should Be Special` ou `Special 7` en licences
incorrectes. Un simple préfixe commun ne suffit donc jamais à fusionner deux
œuvres.

## Intégrité des données

La migration :

1. normalise le nom affiché sur chaque carte ;
2. fusionne les licences principales et secondaires sans perdre de carte ni
   créer de doublon ;
3. conserve les classeurs favoris lors de la fusion ;
4. ajoute un garde-fou sur les futures créations et modifications de cartes.

Elle est transactionnelle : en cas d'erreur, aucune fusion partielle n'est
conservée.

## Validation locale

- replay de toutes les migrations Supabase : réussi ;
- tests de normalisation et de non-régression : réussis ;
- tests de sécurité des migrations : réussis ;
- tests des propriétaires de fonctions SQL : réussis.

Cette migration n'est pas encore appliquée au VPS de production.
