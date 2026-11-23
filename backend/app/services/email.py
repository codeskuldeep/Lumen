import logging
import smtplib
import threading
from email.message import EmailMessage

from app.core.config import get_settings

log = logging.getLogger(__name__)
outbox: list[dict] = []  # inspected by tests / visible in dev


def _send(msg: EmailMessage) -> None:
    s = get_settings()
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=20) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
    except Exception:  # noqa: BLE001
        log.exception("failed to send email to %s", msg["To"])


def send_email(to: str, subject: str, text: str, html: str | None = None) -> None:
    s = get_settings()
    if not s.smtp_host:
        outbox.append({"to": to, "subject": subject, "text": text})
        del outbox[:-50]
        log.info("[dev email] to=%s subject=%s\n%s", to, subject, text)
        return
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.smtp_from, to, subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    threading.Thread(target=_send, args=(msg,), daemon=True).start()


def wrap_html(title: str, body: str) -> str:
    return f"""<div style="font-family:system-ui,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0b0a18;color:#f4f3ff;border-radius:16px">
<h2 style="margin:0 0 12px;color:#c9bcff">{title}</h2>{body}
<p style="color:#8a87a8;font-size:12px;margin-top:24px">Sent by Lumen</p></div>"""
