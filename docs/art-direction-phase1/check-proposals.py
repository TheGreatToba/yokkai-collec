"""Run with: python docs/art-direction-phase1/check-proposals.py"""

from pathlib import Path
from html.parser import HTMLParser
import sys

ROOT = Path(__file__).parent
PALETTES = {
    "Folio Club": ["121716", "1C2421", "18201D", "F4F1E8", "B7C1B8", "D9EDAA"],
    "Light Matter": ["10151F", "1B2431", "17202C", "F0F5FF", "B9C6DB", "A9EAFF"],
    "Culture Press": ["1C1622", "2C2233", "271D2E", "FFF2E9", "D3BACF", "FFB891"],
}


def luminance(hex_color):
    channels = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    channels = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return sum(c * w for c, w in zip(channels, (0.2126, 0.7152, 0.0722)))


def contrast(a, b):
    low, high = sorted([luminance(a), luminance(b)])
    return (high + 0.05) / (low + 0.05)


class Audit(HTMLParser):
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        assert tag != "script", "Static proposals must not include scripts"
        if tag == "html":
            assert attrs.get("lang") == "en"
        if tag == "img":
            assert attrs.get("alt") and attrs.get("width") and attrs.get("height")
        if tag == "a":
            href = attrs.get("href", "")
            if href.endswith(".html"):
                assert (ROOT / href).is_file(), href


assert abs(contrast("000000", "FFFFFF") - 21) < 0.001
assert contrast("FFFFFF", "FFFFFF") == 1
rows = []
for name, (bg, surface, card, ink, muted, accent) in PALETTES.items():
    ratios = [contrast(text, fill) for text in (ink, muted, accent) for fill in (bg, surface, card)]
    ratios += [contrast(rare, card) for rare in ("B7BEC8", "9BD9EC", "C6B7FF", "FFB8A1", "F3D58F")]
    ratios += [contrast("111820", "EAFFFF")]
    # Light Matter uses light lettering on the darker end of a gradient sachet.
    # Pack lettering needs an opaque panel, checked separately after this audit.
    assert min(ratios) >= 4.5, (name, min(ratios))
    rows.append(f"| {name} | {min(ratios):.2f}:1 | Pass |")
for file in ROOT.glob("*.html"):
    Audit().feed(file.read_text(encoding="utf-8"))
report = """# Validation de la phase 1

Contraste WCAG sRGB calculé pour texte principal, secondaire et accent sur fond,
surface et cartouche ; couleurs de rareté sur cartouche ; badge Shiny opaque.

| Direction | Minimum des paires vérifiées | AA texte normal |
| --- | --- | --- |
""" + "\n".join(rows) + """

Contrôle HTML : langue anglaise déclarée, images nommées et dimensionnées,
liens HTML locaux résolus, aucun script. Contraste des gradients décoratifs
exclu : les textes de sachet sont placés sur un fond opaque.

Ce contrôle ne certifie pas l’accessibilité complète ni la reconnaissance en
une seconde. Ces vérifications demandent une évaluation du produit retenu.
Les limites d’inspection navigateur sont indiquées dans la livraison.
"""
if "--write-report" in sys.argv:
    (ROOT / "VALIDATION.md").write_text(report, encoding="utf-8")
print(report)
