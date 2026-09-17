from __future__ import annotations

import json
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from PyQt6.QtCore import QStandardPaths


@dataclass(frozen=True)
class SavedDocument:
    id: int
    name: str
    updated_at: str


class CVRepository:
    """Stores CV drafts in a single SQLite file on the user's computer."""

    def __init__(self, database_path: Path | None = None) -> None:
        if database_path is None:
            app_data = QStandardPaths.writableLocation(
                QStandardPaths.StandardLocation.AppDataLocation,
            )
            database_path = Path(app_data or Path.home() / '.cvzzer') / 'cvzzer.sqlite3'

        database_path.parent.mkdir(parents=True, exist_ok=True)
        self._connection = sqlite3.connect(database_path)
        self._connection.row_factory = sqlite3.Row
        self._connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS cv_documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                payload TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            ''',
        )
        self._connection.commit()

    def list_documents(self) -> list[SavedDocument]:
        rows = self._connection.execute(
            'SELECT id, name, updated_at FROM cv_documents ORDER BY updated_at DESC, id DESC',
        ).fetchall()
        return [SavedDocument(row['id'], row['name'], row['updated_at']) for row in rows]

    def load(self, document_id: int) -> dict[str, Any] | None:
        row = self._connection.execute(
            'SELECT payload FROM cv_documents WHERE id = ?', (document_id,),
        ).fetchone()
        return json.loads(row['payload']) if row else None

    def save(self, document_id: int | None, name: str, payload: dict[str, Any]) -> int:
        now = datetime.now(timezone.utc).isoformat(timespec='seconds')
        serialized_payload = json.dumps(payload, ensure_ascii=False)
        cleaned_name = name.strip() or 'CV sans titre'

        if document_id is None:
            cursor = self._connection.execute(
                'INSERT INTO cv_documents (name, payload, created_at, updated_at) VALUES (?, ?, ?, ?)',
                (cleaned_name, serialized_payload, now, now),
            )
            self._connection.commit()
            return int(cursor.lastrowid)

        self._connection.execute(
            'UPDATE cv_documents SET name = ?, payload = ?, updated_at = ? WHERE id = ?',
            (cleaned_name, serialized_payload, now, document_id),
        )
        self._connection.commit()
        return document_id

    def delete(self, document_id: int) -> None:
        self._connection.execute('DELETE FROM cv_documents WHERE id = ?', (document_id,))
        self._connection.commit()

    def close(self) -> None:
        self._connection.close()
