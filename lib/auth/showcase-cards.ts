import type { Card } from "@/lib/data/cards";

export const AUTH_EVOLUTION_CARDS = [
  {
    id: "a70f37b5-61e2-49b9-a7e5-22320255f589",
    name: "GOGETA",
    rarity: "LR",
    category: "ANIME/MANGA",
    anime: "Dragon Ball",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/44cc99db7683b97405482d5eeab86bb90f72cfcf87e96db4df7453c2f326da05"
  },
  {
    id: "8534f44e-58d6-4b7e-89c7-907a75bed2ff",
    name: "HAWKS",
    rarity: "SSR",
    category: "ANIME/MANGA",
    anime: "My Hero Academia",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/5003474c982a73708d258cc460eb65c08dc5fb3252eab7bdebceec45338f833c-2990e815-aac6-46a8-8b3b-e7409d292428"
  }
] satisfies Card[];

// Public catalogue snapshot verified read-only in production on 2026-10-20.
export const AUTH_SHOWCASE_CARDS = [
  {
    id: "60c0cdbe-2ed5-43f9-aac3-c2bdfa5e4867",
    name: "SATORU GOJO",
    rarity: "LR",
    category: "ANIME/MANGA",
    anime: "JUJUTSU KAISEN",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/0b122eaf3920635bf8ad4335f6e75947899db377c029d236b9430aae01891103-af096724-bd5a-454c-984b-26e07822ea94"
  },
  {
    id: "da1a6d29-12c2-4ad9-a018-a3670473e5a4",
    name: "NEWJEANS",
    rarity: "LR",
    category: "ARTIST",
    anime: "KPOP",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/df67d8dfd8ccf2bac4a3b653fd14b3b52f0d331d884ce2c003a12213244a60a4-8967a841-f1bf-44f2-8bc9-9bca7bdb03bf"
  },
  {
    id: "04fb40cb-05ae-4bad-bfa1-881290d2d5bf",
    name: "MONKEY D. LUFFY",
    rarity: "LR",
    category: "ANIME/MANGA",
    anime: "One Piece",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/179acf9606ae902fe7d9779d2f004084d756516cf43e11deb881ad43145d4a89-1462c1e799f9fc87"
  },
  {
    id: "51fd0fc4-a553-4836-801d-466c529339d3",
    name: "BART SIMPSON",
    rarity: "LR",
    category: "SERIE",
    anime: "THE SIMPSONS",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/739d93eb8a8ce24c00a592e97e86a654862b314a93c184e2318ec009ef10dce6"
  },
  {
    id: "1f3656ba-ced5-4d71-9393-5f6c2260bff9",
    name: "TUNG TUNG TUNG SAHUR",
    rarity: "LR",
    category: "BRAINROT",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/bc1618af5ff3e3fd89c638c7a7b7c5cdd5e0dcbb28ad8c107b148966a6795590"
  }
] satisfies Card[];

export const AUTH_MARQUEE_CARDS = [
  ...AUTH_SHOWCASE_CARDS,
  {
    id: "2ba1b589-365d-4579-a53e-45d579733346",
    name: "BATMAN",
    rarity: "LR",
    category: "COMICS",
    anime: "DC Comics",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/6fbb06831e22dac6a00f5fcd1ba7e7360c9b6b4e391d95721204b388d0c21573"
  },
  {
    id: "f7c7f69a-9ccb-48dc-9467-3495bb5b5ab7",
    name: "ERIC CARTMAN",
    rarity: "LR",
    category: "SERIE",
    anime: "SOUTH PARK",
    image:
      "https://api.yokkai-collec.com/storage/v1/object/public/card-images/2a5e646571538f25b73a2f7625dfb8cf28914d140305552db2e7984a8175be13"
  }
] satisfies Card[];
