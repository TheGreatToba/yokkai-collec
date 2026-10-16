"""Run: python docs/solar-eclipse/check-solar.py"""

import re
from html.parser import HTMLParser
from pathlib import Path

root = Path(__file__).parent
css = (root / "solar.css").read_text(encoding="utf-8")
tokens = dict(re.findall(r"--([\w-]+)\s*:\s*#([\da-fA-F]{6})\s*;", css))


def luminance(color):
    rgb = [int(color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in rgb]
    return sum(v * weight for v, weight in zip(linear, (.2126, .7152, .0722)))


def contrast(a, b):
    low, high = sorted([luminance(a), luminance(b)])
    return (high + .05) / (low + .05)


class Audit(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1s = 0
        self.cards = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        assert tag != "script", "The art-direction prototype must remain static"
        if tag == "html":
            assert attrs.get("lang") == "en"
        self.h1s += tag == "h1"
        self.cards += tag == "article" and "talisman" in attrs.get("class", "").split()
        if tag == "img":
            assert "alt" in attrs and attrs.get("width") and attrs.get("height")
        for attr in ("href", "src"):
            path = attrs.get(attr, "").split("#")[0]
            if path and not path.startswith(("https:", "http:")):
                assert (root / path).is_file(), path


assert contrast("000000", "ffffff") == 21
assert contrast("ffffff", "ffffff") == 1
ratios = [contrast(tokens[text], tokens[bg])
          for text in ("ink", "muted", "gold", "corona", "ember")
          for bg in ("void", "surface", "raised")]
ratios += [contrast(tokens["button-ink"], tokens[color]) for color in ("gold", "corona")]
assert min(ratios) >= 4.5, min(ratios)
for color in ("afb2bc", "d6dce8", "c9d9d8", "e7c97d", "f5e6ab", "f0f6ec"):
    assert contrast(color, tokens["surface"]) >= 4.5
assert contrast("101319", "edf5ed") >= 4.5
audit = Audit()
audit.feed((root / "index.html").read_text(encoding="utf-8"))
assert audit.h1s == 1 and audit.cards == 8
assert re.search(r"prefers-reduced-motion:\s*reduce", css)
assert "object-fit: contain" in css and "focus-visible" in css
assert (root / "assets/eclipse.webp").stat().st_size < 100_000
assert sum(p.stat().st_size for p in (root / "assets").glob("*.webp")) < 450_000
print(f"Text/button minimum contrast: {min(ratios):.2f}:1")
print("Seven rarity variants + showcase, static English HTML, local links, badge contrast and image budgets: pass")
