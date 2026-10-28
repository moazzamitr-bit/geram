#!/usr/bin/env python3
"""Build every Geram brand asset from the two master files in assets/brand/.

  assets/brand/mark-master.png     gold G on cream
  assets/brand/lockup-master.png   G + «گرم» + GERAM on cream
Requires Pillow + numpy. Outputs are committed; not part of `next build`.
"""
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "brand"
PUB = ROOT / "public"
CREAM = (0xF9, 0xF5, 0xEF)
GOLD = np.array([0xC4, 0x9A, 0x62], dtype=np.float32)


def transparent_mark() -> Image.Image:
    im = np.asarray(Image.open(SRC / "mark-master.png").convert("RGB")).astype(np.float32)
    bg = np.median(np.concatenate([im[:20].reshape(-1, 3), im[-20:].reshape(-1, 3)]), axis=0)
    # Un-mix each pixel as alpha*GOLD + (1-alpha)*bg along the bg->gold axis.
    axis = GOLD - bg
    a = ((im - bg) @ axis) / float(axis @ axis)
    a = np.clip((a - 0.06) / 0.88, 0, 1)
    out = np.zeros(im.shape[:2] + (4,), dtype=np.uint8)
    out[..., :3] = GOLD.astype(np.uint8)
    out[..., 3] = (a * 255).round().astype(np.uint8)
    img = Image.fromarray(out, "RGBA")
    bbox = Image.fromarray((a > 0.25).astype(np.uint8) * 255).getbbox()
    img = img.crop(bbox)
    w, h = img.size
    side = max(w, h)
    sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    sq.alpha_composite(img, ((side - w) // 2, (side - h) // 2))
    return sq


def logotype() -> dict[str, Image.Image]:
    im = np.asarray(Image.open(SRC / "logotype-master.png").convert("L")).astype(np.float32)
    bg = float(np.median(np.concatenate([im[:20].ravel(), im[-20:].ravel()])))
    a = np.clip(((bg - im) / bg - 0.08) / 0.8, 0, 1)
    bbox = Image.fromarray((a > 0.3).astype(np.uint8) * 255).getbbox()
    x0, y0, x1, y1 = bbox
    pad = 6
    a = a[max(0, y0 - pad):y1 + pad, max(0, x0 - pad):x1 + pad]
    out = {}
    for name, rgb in (("dark", (0x16, 0x16, 0x16)), ("light", (0xFF, 0xFF, 0xFF))):
        px = np.zeros(a.shape + (4,), dtype=np.uint8)
        px[..., :3] = rgb
        px[..., 3] = (a * 255).round().astype(np.uint8)
        out[name] = Image.fromarray(px, "RGBA")
    return out


def on_cream(mark: Image.Image, size: int, scale: float, h: int | None = None) -> Image.Image:
    h = h or size
    c = Image.new("RGBA", (size, h), CREAM + (255,))
    edge = int(min(size, h) * scale)
    m = mark.resize((edge, edge), Image.Resampling.LANCZOS)
    c.alpha_composite(m, ((size - edge) // 2, (h - edge) // 2))
    return c


def save(img: Image.Image, rel: str, **kw) -> None:
    p = PUB / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    if p.suffix == ".webp":
        img.save(p, "WEBP", quality=90, method=6, **kw)
    elif p.suffix == ".ico":
        img.save(p, sizes=[(16, 16), (32, 32), (48, 48)])
    else:
        (img if img.mode == "RGBA" and kw.get("alpha") else img.convert("RGB")).save(p, optimize=True)
    print(rel, img.size)


def main() -> None:
    mark = transparent_mark()
    mark.resize((512, 512), Image.Resampling.LANCZOS).save(PUB / "brand" / "logo.png", optimize=True)
    for s in (40, 80, 120):
        save(mark.resize((s, s), Image.Resampling.LANCZOS), f"brand/logo-{s}.webp")
    save(mark.resize((256, 256), Image.Resampling.LANCZOS), "brand/logo-mark.webp")
    save(on_cream(mark, 32, 0.9), "brand/favicon-32.png")
    ico = on_cream(mark, 48, 0.9)
    ico.save(ROOT / "app" / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    for s in (192, 512):
        save(on_cream(mark, s, 0.74), f"icons/icon-{s}.png")
        save(on_cream(mark, s, 0.56), f"icons/icon-maskable-{s}.png")  # inside 80% safe zone
    save(on_cream(mark, 180, 0.70), "icons/apple-touch-icon.png")
    for w, h in ((1170, 2532), (1290, 2796)):
        c = Image.new("RGBA", (w, h), CREAM + (255,))
        e = int(w * 0.32)
        c.alpha_composite(mark.resize((e, e), Image.Resampling.LANCZOS), ((w - e) // 2, (h - e) // 2 - int(h * 0.04)))
        save(c, f"splash/apple-splash-{w}x{h}.png")
    for variant, img in logotype().items():
        for h in (32, 64, 96):
            w = round(img.width * h / img.height)
            r = img.resize((w, h), Image.Resampling.LANCZOS)
            save(r, f"brand/logotype-{variant}-{h}.webp")
        img.resize((round(img.width * 192 / img.height), 192), Image.Resampling.LANCZOS).save(PUB / "brand" / f"logotype-{variant}.png", optimize=True)
    # OG image: full lockup on cream, 1200x630.
    lock = Image.open(SRC / "lockup-master.png").convert("RGB")
    lock = lock.crop((180, 140, 1820, 1860))
    edge = np.asarray(lock)
    og_bg = tuple(int(v) for v in np.median(np.concatenate([edge[:6].reshape(-1, 3), edge[-6:].reshape(-1, 3), edge[:, :6].reshape(-1, 3), edge[:, -6:].reshape(-1, 3)]), axis=0))
    og = Image.new("RGB", (1200, 630), og_bg)
    l = lock.resize((int(1640 * 580 / 1720), 580), Image.Resampling.LANCZOS)
    og.paste(l, ((1200 - l.width) // 2, 25))
    og.save(PUB / "brand" / "og.png", optimize=True)
    print("brand/og.png", og.size)


if __name__ == "__main__":
    main()
