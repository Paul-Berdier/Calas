"""Synthetic fixtures only; never imported into the live CMS."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

out = Path(__file__).resolve().parents[1] / 'artifacts' / 'pdf-import' / 'fixtures'
out.mkdir(parents=True, exist_ok=True)
font_path = Path('C:/Windows/Fonts/arial.ttf')
pdfmetrics.registerFont(TTFont('TestArial', str(font_path)))
lines = [
    'Document de test - Qualité des relations',
    'Ce document sert uniquement à vérifier un outil informatique.',
    'Les équipes prennent le temps de partager leurs observations.',
    'Une écoute attentive aide à comprendre les situations de travail.',
    'Le texte doit rester modifiable après son import dans le site.',
]

def text_page(pdf):
    pdf.setFont('TestArial', 18)
    pdf.drawString(45, 770, lines[0])
    pdf.setFont('TestArial', 12)
    for n, line in enumerate(lines[1:]):
        pdf.drawString(45, 710 - n * 32, line)
    pdf.showPage()

scan = Image.new('RGB', (1240, 1754), 'white')
draw = ImageDraw.Draw(scan)
font = ImageFont.truetype(str(font_path), 31)
for n, line in enumerate(lines):
    draw.text((80, 120 + n * 100), line, fill='#111111', font=font)
scan.save(out / 'scan-page.png')

for filename, mode in [('texte.pdf', 'text'), ('scan.pdf', 'scan'), ('mixte.pdf', 'mixed')]:
    pdf = canvas.Canvas(str(out / filename), pagesize=(595, 842))
    pdf.setTitle('Document synthétique pour la recette PDF')
    if mode in ('text', 'mixed'):
        text_page(pdf)
    if mode in ('scan', 'mixed'):
        pdf.drawImage(ImageReader(scan), 0, 0, width=595, height=842)
        pdf.showPage()
    pdf.save()
    reader = PdfReader(out / filename)
    print(filename, 'pages:', len(reader.pages), 'text lengths:', [len(page.extract_text()) for page in reader.pages])
