#!/usr/bin/env python3
"""Render the Crossfoot icon (tools/icon.svg) to every size the app and website use.

    /usr/bin/python3 tools/make_icon.py            # writes app/assets/

Needs rsvg-convert (brew install librsvg) and Pillow (for favicon.ico and the
macOS 1024px icon with Apple's tile padding).
"""
import subprocess
import tempfile
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SVG = ROOT / "tools" / "icon.svg"
OUT = ROOT / "app" / "assets"
SIZES = (16, 32, 48, 64, 128, 180, 256, 512)


def render(size, out):
    subprocess.run(["rsvg-convert", "-w", str(size), "-h", str(size), str(SVG), "-o", str(out)], check=True)


def mac_icon(out):
    """Apple grid: ~824px tile centred on a 1024 canvas, with a soft drop shadow."""
    with tempfile.TemporaryDirectory() as tmp:
        tile_png = Path(tmp) / "tile.png"
        render(824, tile_png)
        tile = Image.open(tile_png).convert("RGBA")
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    shadow = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    alpha = tile.split()[3].point(lambda a: int(a * 0.28))
    shadow.paste((0, 40, 80, 255), (100, 112), alpha)
    canvas = Image.alpha_composite(canvas, shadow.filter(ImageFilter.GaussianBlur(14)))
    canvas.alpha_composite(tile, (100, 100))
    canvas.save(out)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for s in SIZES:
        render(s, OUT / f"icon-{s}.png")
    Image.open(OUT / "icon-48.png").save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    mac_icon(OUT / "icon-mac-1024.png")
    print("icons ->", OUT)


if __name__ == "__main__":
    main()
