# Assets de la proposition

Deux illustrations d’étude originales ont été générées avec l’outil ImageGen intégré, sans clé API ni CLI de génération. Elles représentent des personnages fictifs, pas des célébrités ou des personnages de franchises. Les sources PNG sont conservées dans le répertoire de génération Codex ; les fichiers consommés par les maquettes sont dans ce dossier `assets/`.

Seul l’encodage WebP a été effectué ensuite avec Sharp déjà installé ; aucun cadrage, détourage ou filtre supplémentaire. Les cadres, sigles et reflets sont de vrais éléments CSS/SVG séparés de l’illustration.

## Vesper — assets/vesper.webp

1024 × 1536, 165 040 octets.

Prompt exact :

```text
Use case: stylized-concept. Create a premium original anime character portrait artwork for an art-direction prototype of a global pop-culture collectible web game. NOT a trading card: no border, no lettering, no symbols, no logo, no rarity marks. Portrait canvas 2:3. A charismatic adult silver-haired woman with a short sculptural bob, intense violet eyes, elegant black high collar jacket with small silver fasteners, looking directly toward viewer, subtle three quarter shoulders, one hand near collar. Fine sophisticated anime illustration, restrained painterly texture, exceptional facial drawing and expressive eyes, razor sharp cinematic rim light. Deep black-plum background with subtle violet smoke and sparse pale dust, strong face visibility, beautiful natural skin, no excessive costume ornament, no wings, no weapons, no existing character or recognizable franchise. Subject fills canvas but entire head comfortably inside. Artwork should feel like a desirable rare art print rather than generic fantasy illustration. Mostly black ivory lilac, restrained electric orchid highlight. No text anywhere.
```

Le résultat est un portrait numérique cinématique proche d’un rendu 3D ; le second asset teste volontairement une illustration 2D plate.

## Ren — assets/ren.webp

1254 × 1254, 170 830 octets.

Prompt exact :

```text
Use case: illustration-story. An original premium hand drawn 2D ANIME illustration, not photorealistic, not 3D. Adult male character, dark navy shaggy hair, warm eyes, cream bomber jacket with red lining, quiet confident expression, relaxed seated posture with head and torso visible. Large pale ivory background with graphic red-orange sun disk partly behind shoulders. Actual clean expressive ink outlines, flat cel shading with restrained textured brush highlights, contemporary Japanese magazine illustration quality, highly appealing collectible portrait. Square composition 1:1, entire hair/head comfortably inside, upper body, generous pale negative space. No existing character, no recognizable franchise, no lettering, no logo, no card frame or symbols. Distinct contrast to a dark cinematic portrait: this image is light, warm, flat, drawn.
```

## Photographies externes

- [Portrait sur fond bleu](https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80).
- [Portrait sur fond sombre](https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80).

Les photographies sont chargées à distance, jamais présentées comme des images de célébrités identifiées. Mina et Jules sont des noms d’étude fictifs. Aucun asset de cette proposition n’est importé dans le catalogue du jeu ; le choix et la validation des images de production restent séparés de la sélection de charte.

## Eclipse — assets/eclipse.webp

Décor original généré avec l’outil ImageGen intégré, puis encodé en WebP à composition inchangée : 1536 × 1024, 96 152 octets. Les filaments solaires ne sont pas des particules animées. Le décor n’embarque ni texte ni composant d’interface.

Prompt exact :

```text
Use case: stylized-concept. Create an atmospheric background for an original mystical celestial collector web game called Solar Eclipse (no text in image). Wide landscape 3:2 composition. Almost entirely deep obsidian black #050508. On the RIGHT HALF, a spectacular total solar eclipse, perfectly dark circular moon with an exceptionally thin molten gold solar rim and intricate fine filaments of a real solar corona spreading outward into absolute black. Subtle aged gold dust and two almost invisible engraved astronomical arcs at lower right, luxury ancient astronomical instrument feeling, sublime mysterious sacred atmosphere. LEFT HALF is clean nearly uniform absolute black negative space for real HTML typography. Sophisticated black and antique champagne gold, very restrained ember orange only at the brightest edge. No purple, no blue, no rainbow, no character, no cards, no UI, no wordmark, no symbols or lettering, no scenery, no planets, no heavy nebula or generic fantasy clouds. Physically beautiful photography-like solar plasma with understated luxurious fine-art finish. Keep corona delicate not a large blurry golden glow.
```

## Éléments vectoriels

`assets/logo.svg` et `assets/astrolabe.svg` sont des dessins originaux en SVG. Les montures, sceaux, monnaie et packs sont composés en SVG/CSS dans le HTML, sans dépendance graphique externe. Les captures PNG sont des rendus du navigateur.
