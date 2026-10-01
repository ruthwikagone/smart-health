from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

source = Path('SmartHealth_ChangeSummary.md')
output = Path('SmartHealth_ChangeSummary.pdf')

styles = getSampleStyleSheet()
story = []

for raw in source.read_text(encoding='utf-8').splitlines():
    if not raw.strip():
        story.append(Spacer(1, 8))
        continue

    if raw.startswith('# '):
        story.append(Paragraph(raw[2:], styles['Title']))
        continue

    if raw.startswith('## '):
        story.append(Paragraph(raw[3:], styles['Heading2']))
        continue

    if raw.startswith('### '):
        story.append(Paragraph(raw[4:], styles['Heading3']))
        continue

    if raw.startswith('- '):
        story.append(Paragraph('• ' + raw[2:], styles['BodyText']))
        continue

    if raw.startswith('---'):
        story.append(Spacer(1, 12))
        continue

    story.append(Paragraph(raw, styles['BodyText']))

doc = SimpleDocTemplate(
    str(output),
    pagesize=A4,
    rightMargin=40,
    leftMargin=40,
    topMargin=40,
    bottomMargin=40,
)
doc.build(story)
print(f'Created {output}')
