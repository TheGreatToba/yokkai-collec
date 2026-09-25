"""
Reformate un CSV "manuel" (categorie, nom, rarete, image — ex. kpop) vers le même schéma
de sortie que clean_and_assign_rarity.py, pour que le script d'import Supabase puisse ingérer
n'importe quelle source de la même façon.

Détecte automatiquement les colonnes même avec accents ou noms légèrement différents
(ex. "catégorie", "rareté", "lien image").

Usage :
    python prepare_manual_csv.py input.csv output.csv
"""

import csv
import hashlib
import sys
import unicodedata

RARETES_VALIDES = {"C", "R", "SR", "SSR", "LR"}


def normalize(s: str) -> str:
    s = s.strip().lower()
    s = "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")
    return s


def detect_columns(fieldnames):
    mapping = {}
    for fn in fieldnames:
        norm = normalize(fn)
        if "rarete" in norm and "rarete" not in mapping:
            mapping["rarete"] = fn
        elif "categorie" in norm and "categorie" not in mapping:
            mapping["categorie"] = fn
        elif ("image" in norm or "lien" in norm) and "image" not in mapping:
            mapping["image"] = fn
        elif ("nom" in norm or "personnage" in norm or "name" in norm) and "nom" not in mapping:
            mapping["nom"] = fn

    manquantes = {"rarete", "categorie", "nom", "image"} - mapping.keys()
    if manquantes:
        print(f"ERREUR : colonnes introuvables : {manquantes}")
        print(f"Colonnes détectées dans le fichier : {fieldnames}")
        sys.exit(1)

    return mapping


def make_source_id(categorie: str, nom: str) -> str:
    """Construit un identifiant stable pour rendre les imports manuels relançables."""
    identity = f"{normalize(categorie)}\0{normalize(nom)}"
    digest = hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]
    return f"manual-{digest}"


def main():
    if len(sys.argv) < 3:
        print("Usage: python prepare_manual_csv.py input.csv output.csv")
        sys.exit(1)

    input_path, output_path = sys.argv[1], sys.argv[2]

    fieldnames_out = [
        "source_id", "nom", "categorie", "franchise", "franchise_romaji",
        "image_url", "favoris_count", "rarete_base", "source",
    ]

    n_ok = 0
    n_invalid_rarete = 0

    with open(input_path, newline="", encoding="utf-8-sig") as f_in, \
         open(output_path, "w", newline="", encoding="utf-8") as f_out:

        reader = csv.DictReader(f_in)
        mapping = detect_columns(reader.fieldnames)
        print(f"Colonnes détectées : {mapping}\n")

        writer = csv.DictWriter(f_out, fieldnames=fieldnames_out)
        writer.writeheader()

        for row in reader:
            rarete = (row.get(mapping["rarete"]) or "").strip().upper()
            nom = (row.get(mapping["nom"]) or "").strip()
            categorie = (row.get(mapping["categorie"]) or "").strip()

            if rarete not in RARETES_VALIDES:
                n_invalid_rarete += 1
                print(f"  Rareté invalide ignorée : '{rarete}' pour '{nom}'")
                continue

            writer.writerow({
                "source_id": make_source_id(categorie, nom),
                "nom": nom,
                "categorie": categorie,
                "franchise": "",
                "franchise_romaji": "",
                "image_url": (row.get(mapping["image"]) or "").strip(),
                "favoris_count": "",
                "rarete_base": rarete,
                "source": "manual",
            })
            n_ok += 1

    print(f"\nLignes converties : {n_ok}")
    print(f"Lignes ignorées (rareté invalide) : {n_invalid_rarete}")
    print(f"Fichier écrit : {output_path}")


if __name__ == "__main__":
    main()
