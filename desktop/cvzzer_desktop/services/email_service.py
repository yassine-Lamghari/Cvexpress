from __future__ import annotations

import mimetypes
import os
import smtplib
from email.message import EmailMessage
from pathlib import Path


class EmailConfigurationError(RuntimeError):
    pass


class SMTPEmailService:
    """SMTP adapter configured only through environment variables."""

    def __init__(self) -> None:
        self.host = os.getenv('SMTP_HOST', '').strip()
        self.port = int(os.getenv('SMTP_PORT', '587'))
        self.username = os.getenv('SMTP_USER', '').strip()
        self.password = os.getenv('SMTP_PASS', '')
        self.sender = os.getenv('SMTP_FROM_EMAIL', self.username).strip()
        self.sender_name = os.getenv('SMTP_FROM_NAME', 'CVzzer').strip()
        self.use_ssl = os.getenv('SMTP_USE_SSL', 'false').lower() == 'true'

    def validate_configuration(self) -> None:
        if not all((self.host, self.username, self.password, self.sender)):
            raise EmailConfigurationError(
                'Configuration SMTP incomplète. Définissez SMTP_HOST, SMTP_USER, SMTP_PASS et SMTP_FROM_EMAIL.',
            )

    def send(self, recipient: str, subject: str, body: str, attachments: list[str]) -> None:
        self.validate_configuration()
        message = EmailMessage()
        message['From'] = f'{self.sender_name} <{self.sender}>'
        message['To'] = recipient
        message['Subject'] = subject.replace('\r', ' ').replace('\n', ' ')
        message.set_content(body)

        for attachment in attachments:
            path = Path(attachment)
            if not path.is_file():
                raise FileNotFoundError(f'Pièce jointe introuvable : {path}')
            mime_type, _ = mimetypes.guess_type(path.name)
            maintype, subtype = (mime_type or 'application/octet-stream').split('/', 1)
            message.add_attachment(path.read_bytes(), maintype=maintype, subtype=subtype, filename=path.name)

        connection = smtplib.SMTP_SSL(self.host, self.port, timeout=30) if self.use_ssl else smtplib.SMTP(self.host, self.port, timeout=30)
        with connection:
            if not self.use_ssl:
                connection.starttls()
            connection.login(self.username, self.password)
            connection.send_message(message)
