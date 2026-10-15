# Cadrage des personnages de bannière

Les illustrations de cartes ne sont pas des bannières panoramiques. Le composant
`ProfileBanner` conserve l'illustration entière (`object-fit: contain`) sur un
fond flouté et assombri provenant de la même image. La diagonale décorative est
réservée aux bannières vides, et non superposée aux images.

Les images importées restent prioritaires et conservent leur recadrage existant
(`cover`, position `center 28%`). Aucune donnée enregistrée n'est modifiée, aucune
migration n'est nécessaire, et les limites de taille et formats sont inchangés.

L'éditeur de personnage emploie le même composant que le profil public.

## Vérification ciblée

- `node --test tests/profile-banner.test.mjs`
- Avec le serveur local sur le port 3000 :
  `node scripts/browser-proof-profile-banner.mjs`

La preuve navigateur utilise les données simulées de l'aperçu local et n'écrit
pas dans Supabase. Elle couvre les formats portrait, paysage et carré à 390,
768, 1024, 1920 et 3840 pixels, l'aperçu dans l'éditeur, l'import et le retrait
d'une bannière. Les captures sont générées dans `artifacts/profile-banner-fit/`.

Les assertions des tests existants ne sont pas modifiées. Le chargeur de test
de confidentialité charge le véritable composant `ProfileBanner` nouvellement
extrait, sans remplacer son rendu par un mock.
