"""Render every PDF page and contact sheets for visual quality control."""
from pathlib import Path
import pymupdf
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / 'tmp/pdfs'
doc = pymupdf.open(ROOT / 'output/pdf/Patea_Game_Producto_y_Oportunidades.pdf')
for i, page in enumerate(doc):
    page.get_pixmap(matrix=pymupdf.Matrix(1.5, 1.5)).save(TMP / f'page-{i+1:02}.png')
for start in range(0, len(doc), 12):
    sheet = Image.new('RGB', (1684, 3 * 325), '#394356')
    draw = ImageDraw.Draw(sheet)
    for j in range(start, min(start+12, len(doc))):
        image = Image.open(TMP / f'page-{j+1:02}.png').convert('RGB')
        image.thumbnail((411, 291))
        x, y = ((j-start) % 4) * 421, ((j-start) // 4) * 325
        sheet.paste(image, (x, y+20))
        draw.text((x+6, y+4), str(j+1), fill='white')
    sheet.save(TMP / f'review-{start//12+1}.jpg', quality=95)
print('Rendered', len(doc), 'pages')
