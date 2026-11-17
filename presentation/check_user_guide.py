"""Check page size, destinations, text boundaries and measured paragraph overlap."""
from pathlib import Path
import json
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'output/pdf/Patea_Guia_de_Uso_Game_A4.pdf'
document = pymupdf.open(path)
issues = []
for number, page in enumerate(document, 1):
    if abs(page.rect.width-595.2756) > .1 or abs(page.rect.height-841.8898) > .1:
        issues.append((number, 'Page is not A4 portrait'))
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            for span in line['spans']:
                x0, y0, x1, y1 = span['bbox']
                if x0 < 0 or y0 < 0 or x1 > page.rect.width or y1 > page.rect.height:
                    issues.append((number, 'Text outside page', span['text']))
                if '\ufffd' in span['text']:
                    issues.append((number, 'Replacement glyph'))
    for link in page.get_links():
        if link.get('page', 0) not in range(len(document)):
            issues.append((number, 'Invalid link destination'))
boxes = json.loads((ROOT/'tmp/pdfs/guide-layout-audit.json').read_text(encoding='utf8'))
for i, first in enumerate(boxes):
    for second in boxes[i+1:]:
        if first['page'] != second['page']:
            continue
        overlap_x = min(first['x']+first['w'], second['x']+second['w'])-max(first['x'], second['x'])
        overlap_y = min(first['y']+first['h'], second['y']+second['h'])-max(first['y'], second['y'])
        if overlap_x > 1 and overlap_y > 1:
            issues.append((first['page'], 'Paragraph overlap', first['text'][:30], second['text'][:30]))
assert len(document) == 50
assert len(document.get_toc()) == 50
assert not issues, issues
print(f'Checked {len(document)} A4 pages, 50 bookmarks and '
      f'{sum(len(page.get_links()) for page in document)} links. No layout issues. '
      f'{path.stat().st_size:,} bytes.')
