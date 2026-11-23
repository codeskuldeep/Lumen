from datetime import UTC, datetime
from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

ENGINE_LABEL = {"chatgpt": "ChatGPT", "google_aio": "Google AI Overviews"}


def build_pdf(agency_name: str, color_hex: str, client_name: str, ov: dict, prompt_rows: list[dict]) -> bytes:
    brand = colors.HexColor(color_hex)
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm, topMargin=18 * mm, bottomMargin=16 * mm, title=f"{client_name} AI Visibility Report")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=brand, alignment=0, fontSize=22, spaceAfter=2)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=colors.HexColor("#1b1b2f"), spaceBefore=14, spaceAfter=6)
    small = ParagraphStyle("s", parent=ss["Normal"], textColor=colors.grey, fontSize=9)

    def table(data, widths=None):
        t = Table(data, colWidths=widths, repeatRows=1)
        t.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), brand),
                    ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                    ("FONTSIZE", (0, 0), (-1, -1), 9),
                    ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f3ff")]),
                    ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#dcdaf5")),
                    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                    ("TOPPADDING", (0, 0), (-1, -1), 5),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ]
            )
        )
        return t

    cur, prev = ov["current"], ov["previous"]
    delta = cur["visibility"] - prev["visibility"]
    s = [
        Paragraph(f"{client_name} — AI Visibility Report", h1),
        Paragraph(f"Prepared by {agency_name} · last {ov['days']} days · {datetime.now(UTC):%d %b %Y}", small),
        Spacer(1, 8),
        Paragraph("Summary", h2),
        table(
            [
                ["Visibility", "Share of voice", "Avg. position", "Answers analysed"],
                [f"{cur['visibility']}%  ({delta:+.1f} pts)", f"{cur['share_of_voice']}%", cur["avg_position"] or "—", cur["runs"]],
            ]
        ),
        Paragraph("By AI engine", h2),
        table(
            [["Engine", "Answers", "Visibility", "Avg. position"]] + [[ENGINE_LABEL.get(e["engine"], e["engine"]), e["runs"], f"{e['visibility']}%", e["avg_position"] or "—"] for e in ov["by_engine"]]
        ),
        Paragraph("Brand comparison", h2),
        table(
            [["Brand", "Mentions", "Share", "Avg. position"]] + [[("★ " if b["is_client"] else "") + b["name"], b["mentions"], f"{b['share']}%", b["avg_position"] or "—"] for b in ov["brands"][:10]]
        ),
        Paragraph("Most cited sources", h2),
        table([["Domain", "Citations"]] + [[c["domain"], c["count"]] for c in ov["top_citations"]]),
        Paragraph("Tracked prompts", h2),
        table([["Prompt", "Runs", "Visibility"]] + [[Paragraph(p["text"], ss["Normal"]), p["runs"], f"{p['visibility']}%"] for p in prompt_rows[:40]], [110 * mm, 20 * mm, 30 * mm]),
    ]
    doc.build(s)
    return buf.getvalue()
