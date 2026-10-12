#!/usr/bin/env python3
"""Rebuild the deliberately redacted public resume. Requires reportlab."""
from pathlib import Path
from html import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "downloads"
OUT.mkdir(parents=True, exist_ok=True)
FONT_DIR = Path("/usr/share/fonts/truetype/dejavu")
pdfmetrics.registerFont(TTFont("ResumeSans", str(FONT_DIR / "DejaVuSans.ttf")))
pdfmetrics.registerFont(TTFont("ResumeSansBold", str(FONT_DIR / "DejaVuSans-Bold.ttf")))
pdfmetrics.registerFontFamily("ResumeSans", normal="ResumeSans", bold="ResumeSansBold")

NAVY = colors.HexColor("#18243B")
BODY = colors.HexColor("#354052")
MUTED = colors.HexColor("#606B7B")
ACCENT = colors.HexColor("#26706A")

styles = {
    "name": ParagraphStyle("name", fontName="ResumeSansBold", fontSize=24, leading=29, textColor=NAVY, spaceAfter=6),
    "role": ParagraphStyle("role", fontName="ResumeSans", fontSize=11, leading=15, textColor=ACCENT, spaceAfter=8),
    "contact": ParagraphStyle("contact", fontName="ResumeSans", fontSize=8.2, leading=12, textColor=MUTED, spaceAfter=6),
    "section": ParagraphStyle("section", fontName="ResumeSansBold", fontSize=9, leading=12, textColor=ACCENT, spaceBefore=14, spaceAfter=7),
    "body": ParagraphStyle("body", fontName="ResumeSans", fontSize=9, leading=13, textColor=BODY, spaceAfter=6),
    "sub": ParagraphStyle("sub", fontName="ResumeSansBold", fontSize=9, leading=13, textColor=NAVY, spaceBefore=3, spaceAfter=3),
    "fine": ParagraphStyle("fine", fontName="ResumeSans", fontSize=7.5, leading=10.5, textColor=MUTED, spaceAfter=4),
}

story = []
def p(text, style="body"):
    story.append(Paragraph(text, styles[style]))

def section(label):
    p(label.upper(), "section")

def href(url, label=None):
    return f'<link href="{escape(url, quote=True)}" color="#26706A">{escape(label or url)}</link>'

p("JONATHAN BONNER", "name")
p("Prince Jona | Software + creative engineering", "role")
p(href("https://princejona.me/work/", "princejona.me/work") + "  |  " + href("https://www.intervised.com", "intervised.com") + "  |  " + href("mailto:contact@intervised.com", "contact@intervised.com"), "contact")
story.append(HRFlowable(width="100%", thickness=1, color=ACCENT, spaceBefore=4, spaceAfter=10))
p("Founder and lead engineer at Intervised. Build useful public interfaces, local audio workflows and artist-facing web experiences with clear scope, inspectable artifacts and practical handoff.")

section("Current experience")
p("Intervised LLC - Founder &amp; lead engineer | 2021-present", "sub")
p("Software and creative workflow development, public web interfaces and artist website work. Focus on understandable behavior, recoverable local state and a defined delivery scope.")

section("Selected public work")
p("JonaAudio - Local browser audio workspace", "sub")
p("Waveform/spectrum, tempo/key estimates, sampling regions, reference-note planning, on-demand level and reference measurements, worker WAV export and session metadata relinking. M6 records 39 regression checks and Chromium synthetic-WAV import/export/relink evidence; physical-device, long-original-media and musical-quality acceptance remain limited.")
p(href("https://princejona.me/work/cases/jonaaudio/", "princejona.me/work/cases/jonaaudio"), "fine")
p("Universe - Public discovery and editor navigation", "sub")
p("Shared catalog, keyboard search, task routes and responsive navigation. Editor returns preserve local editing contexts or await metadata saves. S0/S1 records 45 Node checks and Chromium navigation/layout evidence. Craft engine work retains upstream attribution.")
p(href("https://princejona.me/work/cases/universe/", "princejona.me/work/cases/universe"), "fine")
p("Heartz4Sale - Artist website contribution", "sub")
p("Public artist web presence for Hbkrevenge across releases, merchandise and show-related discovery. Artist brand and content belong to their respective owners; no commercial-growth statistics are asserted.")
p(href("https://princejona.me/work/cases/heartz4sale/", "princejona.me/work/cases/heartz4sale"), "fine")

section("Skills")
p("<b>Public project evidence:</b> JavaScript modules, static HTML/CSS, Web Audio API, Web Workers, IndexedDB-aware recovery, Node regression checks and Playwright browser checks.")
p("<b>Additional owner-reported skills:</b> TypeScript, React, Tailwind CSS, Node.js, Python, SQL, REST APIs, MongoDB, Gradio and Docker. This inventory does not imply every technology appears in the projects above.")

section("Selective earlier experience")
p("<b>Hostos Community College:</b> IT support / media design | September 2019-June 2020.<br/><b>JobsPlus:</b> IT support / tutoring | 2017-2018.")

section("Education & training")
p("<b>General Assembly:</b> Software Engineering Bootcamp | January-May 2022.<br/><b>Borough of Manhattan Community College:</b> Human Services coursework; no completed degree claimed.")

def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D9DFE5"))
    canvas.line(42, 34, 570, 34)
    canvas.setFont("ResumeSans", 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(42, 23, "PUBLIC EDITION - 12 OCT 2026 - Skills proof: princejona.me/work/cases/resume/")
    canvas.drawRightString(570, 23, str(doc.page))
    canvas.restoreState()

document = SimpleDocTemplate(
    str(OUT / "jonathan-bonner-resume.pdf"), pagesize=letter,
    leftMargin=42, rightMargin=42, topMargin=38, bottomMargin=45,
    title="Jonathan Bonner / Prince Jona - Public Resume",
    author="Prince Jona / Intervised", subject="Public software and creative engineering resume",
)
document.build(story, onFirstPage=footer, onLaterPages=footer)

text = """JONATHAN BONNER / PRINCE JONA
Software + creative engineering
https://princejona.me/work/
https://www.intervised.com
Professional contact: contact@intervised.com

Founder and lead engineer at Intervised. Build useful public interfaces, local audio workflows and artist-facing web experiences with clear scope, inspectable artifacts and practical handoff.

CURRENT EXPERIENCE
Intervised LLC - Founder & lead engineer | 2021-present
Software and creative workflow development, public web interfaces and artist website work. Focus on understandable behavior, recoverable local state and a defined delivery scope.

SELECTED PUBLIC WORK
JonaAudio - Local browser audio workspace
Waveform/spectrum, tempo/key estimates, sampling regions, reference-note planning, on-demand level/reference measurements, worker WAV export and session metadata relinking. M6 records 39 regression checks and Chromium synthetic-WAV import/export/relink evidence. Physical-device, long-original-media and musical-quality acceptance remain limited.
https://princejona.me/work/cases/jonaaudio/

Universe - Public discovery and editor navigation
Shared catalog, keyboard search, task routes and responsive navigation. Editor returns preserve local editing contexts or await metadata saves. S0/S1 records 45 Node checks and Chromium navigation/layout evidence. Craft engine work retains upstream attribution.
https://princejona.me/work/cases/universe/

Heartz4Sale - Artist website contribution
Public artist web presence for Hbkrevenge across releases, merchandise and show-related discovery. Artist brand and content belong to their respective owners. No commercial-growth statistics asserted.
https://princejona.me/work/cases/heartz4sale/

SKILLS
Public project evidence: JavaScript modules, static HTML/CSS, Web Audio API, Web Workers, IndexedDB-aware recovery, Node regression checks and Playwright browser checks.
Additional owner-reported skills: TypeScript, React, Tailwind CSS, Node.js, Python, SQL, REST APIs, MongoDB, Gradio and Docker. This inventory does not imply every technology appears in the projects above.

SELECTIVE EARLIER EXPERIENCE
Hostos Community College - IT support / media design | September 2019-June 2020
JobsPlus - IT support / tutoring | 2017-2018

EDUCATION & TRAINING
General Assembly - Software Engineering Bootcamp | January-May 2022
Borough of Manhattan Community College - Human Services coursework; no completed degree claimed

PUBLIC EDITION - 12 OCT 2026
Skills proof: https://princejona.me/work/cases/resume/
"""
(OUT / "jonathan-bonner-resume.txt").write_text(text)
print("Built public resume PDF + TXT")
