"""Generate the SON AR.js pattern marker (.patt) and a printable marker image.

Usage: python Tools/make_marker.py
Writes:
  Assets/Resources/Markers/son.patt      (AR.js pattern, picked up by PostBuildActions)
  Assets/WebGLTemplates/WebAR/marker/son-marker.png  (printable / show on another screen)
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "Assets/Fonts/Roboto-Bold.ttf"
INNER = 512          # inner pattern size (px)
RATIO = 0.5          # AR.js default patternRatio: inner = 50% of full marker
ACCENT = (0, 0, 0)  # keep high contrast for reliable detection


def inner_image():
    img = Image.new("RGB", (INNER, INNER), "white")
    d = ImageDraw.Draw(img)
    # asymmetric layout so all 4 rotations are distinguishable
    d.rectangle([48, 48, 48 + INNER // 4, 48 + INNER // 4], fill=ACCENT)
    font = ImageFont.truetype(str(FONT), 200)
    d.text((INNER // 2, INNER * 0.62), "SON", font=font, fill="black", anchor="mm")
    d.rectangle([INNER * 0.55, INNER * 0.86, INNER * 0.95, INNER * 0.94], fill="black")
    return img


def full_marker(inner):
    full = int(INNER / RATIO)
    border = (full - INNER) // 2
    img = Image.new("RGB", (full, full), "black")
    img.paste(inner, (border, border))
    margin = full // 10
    out = Image.new("RGB", (full + 2 * margin, full + 2 * margin), "white")
    out.paste(img, (margin, margin))
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
    inner = inner_image()
    patt_path = ROOT / "Assets/Resources/Markers/son.patt"
    patt_path.write_text(patt(inner), newline="\n")
    png_dir = ROOT / "Assets/WebGLTemplates/WebAR/marker"
    png_dir.mkdir(parents=True, exist_ok=True)
    full_marker(inner).save(png_dir / "son-marker.png")
    print("wrote", patt_path, "and", png_dir / "son-marker.png")


if __name__ == "__main__":
    main()
