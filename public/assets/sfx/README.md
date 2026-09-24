# Audio de présentation

Les neuf fichiers WAV sont des placeholders originaux générés localement pour
cette intégration, sans source audio tierce. Ils peuvent être remplacés par les
sons finaux en conservant les noms : rumble, tear, flip, slide, sr, ssr, lr, shiny,
flutter. PCM mono, 22 050 Hz, 16 bits.

Le hook `hooks/use-sfx.ts` charge les fichiers à la première interaction et
ignore les erreurs audio pour ne pas bloquer l'ouverture métier du booster.
