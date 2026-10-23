#!/usr/bin/env python3
"""Build maskable, apple-touch, and startup icons from public/icons/icon-512.png.

Requires Pillow. Not part of `next build` (the PNGs are committed).
Does not fetch or copy third-party brand assets.
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "public" / "icons" / "icon-512.png"
INK = (0x16, 0x16, 0x16, 255)  # same ink as the logged-in app buttons
CREAM = (0xF6, 0xF4, 0xF1, 255)


def paste_mark(canvas: Image.Image, mark: Image.Image, scale: float, dy: int = 0) -> None:
    size = canvas.size[0]
    edge = max(1, int(size * scale))
    resized = mark.resize((edge, edge), Image.Resampling.LANCZOS)
    offset = ((size - edge) // 2, (canvas.size[1] - edge) // 2 + dy)
    canvas.alpha_composite(resized, offset)


def save_rgb(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(path, optimize=True)
    print(path.relative_to(ROOT), image.size)


def main() -> None:
    mark = Image.open(SRC).convert("RGBA")
    icons = ROOT / "public" / "icons"
    for size in (192, 512):
        canvas = Image.new("RGBA", (size, size), INK)
        # ~61% content box so the glyph stays inside Android's circular mask.
        paste_mark(canvas, mark, 0.66)
        save_rgb(canvas, icons / f"icon-maskable-{size}.png")

    touch = Image.new("RGBA", (180, 180), INK)
    paste_mark(touch, mark, 0.72)
    save_rgb(touch, icons / "apple-touch-icon.png")

    splash_dir = ROOT / "public" / "splash"
    # Two practical portrait sizes. Other iPhones fall back to the default splash.
    for width, height in ((1170, 2532), (1290, 2796)):
        canvas = Image.new("RGBA", (width, height), CREAM)
        edge = int(width * 0.28)
        resized = mark.resize((edge, edge), Image.Resampling.LANCZOS)
        canvas.alpha_composite(
            resized,
            ((width - edge) // 2, (height - edge) // 2 - int(height * 0.06)),
        )
        save_rgb(canvas, splash_dir / f"apple-splash-{width}x{height}.png")


if __name__ == "__main__":
    main()
