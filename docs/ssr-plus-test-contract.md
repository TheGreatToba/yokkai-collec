# Contrat de tests SSR+

Validation de Walid confirmée par l’utilisateur le 15 octobre 2026.

Cette PR de tests seule remplace le contrat produit abandonné UR par SSR+ :
la fusion consomme toujours exactement cinq SSR identiques non améliorées.
La carte produite reste une SSR rose, avec la finition holographique et un
badge « + ». Les LR Shiny restent inchangées. Aucun taux de drop ne change.

Le test de présentation conserve les assertions existantes : cinq copies,
confirmation, sélection explicite et avertissement sur l’image personnalisée.
Avant installation du module `lib/ui/card-variant.ts`, il exige les anciens
libellés ; après installation, il exige exclusivement SSR+ et rejette UR.
Ce marqueur permet de merger les tests séparément avant le code produit.

Les tests de rendu et de mécanique déjà existants ne sont pas affaiblis.
Les nouveaux tests du code produit vérifieront le rose SSR, le symbole +,
le maintien des effets holographiques et l’absence de rareté UR.

Migrations Supabase : aucune. Aucune intervention sur le VPS.
