from __future__ import annotations

import re

from ..models import Contact


TOKEN_PATTERN = re.compile(r'\{\{\s*([a-z_]+)\s*\}\}', re.IGNORECASE)


def personalise(template: str, contact: Contact) -> str:
    values = contact.variables()
    return TOKEN_PATTERN.sub(lambda match: values.get(match.group(1).lower(), match.group(0)), template)
