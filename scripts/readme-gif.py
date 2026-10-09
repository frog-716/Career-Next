"""Encode screenshots of the real frontend; requires Pillow (no image generation)."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parent.parent
frames = sorted((root / 'out/readme-frames').glob('[0-9][0-9][0-9].png'))
if not frames:
    raise SystemExit('Run scripts/readme-capture.ts first.')
images = [Image.open(frame).convert('RGB').resize((1008, 504), Image.Resampling.LANCZOS) for frame in frames]
palette = images[0].quantize(colors=192)
indexed = [image.quantize(palette=palette, dither=Image.Dither.NONE) for image in images]
indexed[0].save(root / 'docs/assets/readme/opportunity-tour.gif', save_all=True,
                append_images=indexed[1:], duration=[1400 if i % 6 == 5 else 120 for i in range(len(indexed))],
                loop=0, optimize=True, disposal=2)
print('README animation encoded.')
