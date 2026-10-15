# Contrat des animations de drop vidéo

Changement produit validé avec Walid par l’utilisateur le 15 octobre 2026.
PR de tests séparée, avant le code produit.

Les anciens flashes, particules et durées CSS SR/SSR/LR sont remplacés par les
trois vidéos fournies. L’utilisateur refuse les personnages pré-incrustés : la
zone centrale est donc toujours masquée et la vraie carte est affichée au-dessus.
Le masque retire aussi les effets de cette zone ; les effets extérieurs restent.

Les nouveaux contrats vérifient les trois fichiers distincts, la vraie carte,
le dos du jeu, la fin et les erreurs de lecture, le bouton pour passer, la
lecture inline/muette, le masque central et le mouvement réduit. Aucun droit,
taux de drop, original d’image ou mécanisme de partage n’est assoupli.

L’ancien contrat reste exigé tant que le composant vidéo n’est pas installé ;
ensuite seul le nouveau contrat est accepté. Le fingerprint du bloc CSS est
remplacé par les assertions du nouveau contrat approuvé, pas supprimé sans
remplacement. Le test du chatoiement des Shiny et les tests de partage restent.

Migrations Supabase : aucune. Aucun changement appliqué sur le VPS.
