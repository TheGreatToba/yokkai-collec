"""Run: python docs/art-direction-enchantment/check-study.py"""

import re
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).parent
css = (ROOT / "study.css").read_text(encoding="utf-8")


def luminance(value):
    channels = [int(value[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + .055) / 1.055) ** 2.4 for c in channels]
    return sum(c * w for c, w in zip(linear, (.2126, .7152, .0722)))


def contrast(a, b):
    low, high = sorted([luminance(a), luminance(b)])
    return (high + .05) / (low + .05)


class Audit(HTMLParser):
    def __init__(self):
        super().__init__()
        self.h1s = 0
        self.cards = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        assert tag != "script", "Static studies must not load scripts"
        if tag == "html":
            assert attrs.get("lang") == "en"
        self.h1s += tag == "h1"
        self.cards += tag == "article" and "collectible" in attrs.get("class", "").split()
        if tag == "img":
            assert attrs.get("alt") and attrs.get("width") and attrs.get("height")
        for attr in ("href", "src"):
            ref = attrs.get(attr, "").split("#")[0]
            if ref and not ref.startswith(("http:", "https:")):
                assert (ROOT / ref).is_file(), ref


assert contrast("000000", "ffffff") == 21
assert contrast("ffffff", "ffffff") == 1
for name in ("obsidian", "scarlet", "astral"):
    block = re.search(r"\." + name + r"\s*\{([^}]+)\}", css)[1]
    tokens = dict(re.findall(r"--([\w-]+)\s*:\s*([^;]+);", block))
    ratios = [contrast(tokens[text][1:], tokens[bg][1:])
              for text in ("ink", "muted", "accent", "gold")
              for bg in ("bg", "surface")]
    ratios += [contrast(tokens["button-ink"][1:], color)
               for color in re.findall(r"#([\da-fA-F]{6})", tokens["button"])]
    assert min(ratios) >= 4.5, (name, min(ratios))
    page = Audit()
    page.feed((ROOT / f"{name}.html").read_text(encoding="utf-8"))
    assert page.h1s == 1 and page.cards == 8, (name, page.h1s, page.cards)
    print(f"{name}: text contrast minimum {min(ratios):.2f}:1; eight card specimens; links OK")
for color in ("bac3d5", "c4e9ff", "cdb7ff", "ffb29b", "ffe1a1", "f8f5ff", "c3bed1"):
    assert contrast(color, "0c0a12") >= 4.5
assert contrast("100e18", "ecffff") >= 4.5
for path in ROOT.glob("assets/*.webp"):
    assert path.stat().st_size < 200_000, path
index = Audit()
index.feed((ROOT / "index.html").read_text(encoding="utf-8"))
assert index.h1s == 1
assert re.search(r"prefers-reduced-motion:\s*reduce", css)
assert "object-fit: contain" in css and "focus-visible" in css
print("Card text, Shiny badge, local assets, image budgets and static HTML: pass")
