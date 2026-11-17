"""Render every PDF page and contact sheets for visual quality control."""
from pathlib import Path
import sys
import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
guide = '--guide' in sys.argv
TMP = ROOT / 'tmp/pdfs' / ('guide' if guide else '')
TMP.mkdir(parents=True, exist_ok=True)
name = 'Patea_Guia_de_Uso_Game_A4.pdf' if guide else 'Patea_Game_Producto_y_Oportunidades.pdf'
doc = pymupdf.open(ROOT / 'output/pdf' / name)
for i, page in enumerate(doc):
    page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(TMP / f'page-{i+1:02}.png')
cell_w, cell_h = (300, 450) if guide else (421, 325)
for start in range(0, len(doc), 12):
    sheet = Image.new('RGB', (4 * cell_w, 3 * cell_h), '#394356')
    draw = ImageDraw.Draw(sheet)
    for j in range(start, min(start+12, len(doc))):
        image = Image.open(TMP / f'page-{j+1:02}.png').convert('RGB')
        image.thumbnail((cell_w-10, cell_h-30))
        x, y = ((j-start) % 4) * cell_w, ((j-start) // 4) * cell_h
        sheet.paste(image, (x, y+20))
        draw.text((x+6, y+4), str(j+1), fill='white')
    sheet.save(TMP / f'review-{start//12+1}.jpg', quality=95)
print('Rendered', len(doc), 'pages')
