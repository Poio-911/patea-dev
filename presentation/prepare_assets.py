"""Prepare official brand assets and Flutter captures for the PDF."""
from pathlib import Path
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / 'tmp/pdfs'
ASSETS = TMP / 'assets'
ASSETS.mkdir(parents=True, exist_ok=True)
(ROOT / 'output/pdf').mkdir(parents=True, exist_ok=True)
for source in (ROOT / 'patea_mobile/build/presentation_capture').glob('*.png'):
    image = Image.open(source).convert('RGB')
    image.thumbnail((720, 1600), Image.Resampling.LANCZOS)
    image.save(ASSETS / (source.stem + '.jpg'), quality=93, subsampling=0)
    # Detail crops retain the real component and remove empty screen space.
    if source.stem == 'user_menu':
        image.crop((0, 430, image.width, image.height)).save(
            ASSETS / 'user_menu_detail.jpg', quality=93, subsampling=0)
    elif source.stem == 'clip_upload':
        image.crop((0, 0, image.width, 470)).save(
            ASSETS / 'clip_upload_detail.jpg', quality=93, subsampling=0)
for source in (ROOT / 'patea_mobile/assets/brand').glob('*.webp'):
    Image.open(source).convert('RGB').save(ASSETS / (source.stem + '.jpg'), quality=93)
script = r"""
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
(async () => {
const root = process.cwd();
const base = path.join(root, 'patea_mobile/assets/icons');
const out = path.join(root, 'tmp/pdfs');
const logo = fs.readFileSync(path.join(base,'logo_patea.svg'),'utf8').replace(/currentColor/g,'#CCFF33');
await sharp(Buffer.from(logo)).resize(160).png().toFile(path.join(out,'patea-mark.png'));
for (const name of ['soccer-field','shirt-sport','ball-football','map-search','clipboard-check']) {
const svg = fs.readFileSync(path.join(base,'nav-'+name+'.svg'),'utf8').replace(/currentColor/g,'#CCFF33');
await sharp(Buffer.from(svg)).resize(100,100).png().toFile(path.join(out,name+'.png'));
}
})();
"""
subprocess.run(['node', '-e', script], cwd=ROOT, check=True)
print('Prepared PDF assets:', ASSETS)
