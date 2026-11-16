"""Generate the SON AR.js pattern markers (.patt) and printable marker images.

Usage: python Tools/make_marker.py
Writes, for each marker in MARKERS:
  Assets/Resources/Markers/<id>.patt                 (AR.js pattern, picked up by PostBuildActions)
  Assets/WebGLTemplates/WebAR/marker/<id>.png        (print it / show it on another screen)

The 4x4 grids were picked by a search so that no marker (in any rotation) correlates with
another above ~0.17; AR.js then never mistakes one SON marker for another.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "Assets/Fonts/Roboto-Bold.ttf"
INNER = 512          # inner pattern size (px)
RATIO = 0.5          # AR.js default patternRatio: inner = 50% of full marker

# id, label printed above the marker, 4x4 grid (1 = black)
MARKERS = [
    ("son1", "SON 1  DANCE", [[0, 0, 1, 0], [1, 1, 1, 1], [0, 0, 1, 0], [0, 0, 0, 1]]),
    ("son2", "SON 2  SPIN",  [[0, 0, 0, 1], [1, 0, 1, 0], [1, 0, 1, 0], [1, 1, 1, 1]]),
    ("son3", "SON 3  JUMP",  [[0, 1, 0, 1], [0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 0, 1]]),
    ("son4", "SON 4  GIANT", [[0, 0, 0, 1], [1, 0, 0, 1], [0, 0, 1, 1], [0, 0, 1, 0]]),
]


def inner_image(grid):
    img = Image.new("RGB", (INNER, INNER), "white")
    d = ImageDraw.Draw(img)
    cell = INNER // 4
    for y, row in enumerate(grid):
        for x, v in enumerate(row):
            if v:
                d.rectangle([x * cell, y * cell, (x + 1) * cell - 1, (y + 1) * cell - 1], fill="black")
    return img


def full_marker(inner, label):
    full = int(INNER / RATIO)
    border = (full - INNER) // 2
    img = Image.new("RGB", (full, full), "black")
    img.paste(inner, (border, border))
    margin = full // 8
    out = Image.new("RGB", (full + 2 * margin, full + 2 * margin), "white")
    out.paste(img, (margin, margin))
    d = ImageDraw.Draw(out)
    d.text((out.width // 2, margin // 2), label, font=ImageFont.truetype(str(FONT), margin // 2), fill="black", anchor="mm")
    return out


def patt(inner):
    # mirrors AR.js threex-arpatternfile.js: 4 orientations (0, -90, -180, -270 deg),
    # 16x16 samples, channels written B, G, R
    lines = []
    for k in range(4):
        rot = inner.rotate(90 * k).resize((16, 16), Image.BILINEAR)
        px = rot.load()
        if k:
            lines.append("")
        for ch in (2, 1, 0):
            for y in range(16):
                lines.append(" ".join(f"{px[x, y][ch]:3d}" for x in range(16)))
    return "\n".join(lines) + "\n"


def main():
    png_dir = ROOT / "Assets/WebGLTemplates/WebAR/marker"
    png_dir.mkdir(parents=True, exist_ok=True)
    for mid, label, grid in MARKERS:
        inner = inner_image(grid)
        (ROOT / f"Assets/Resources/Markers/{mid}.patt").write_text(patt(inner), newline="\n")
        full_marker(inner, label).save(png_dir / f"{mid}.png")
        print("wrote", mid)


if __name__ == "__main__":
    main()
