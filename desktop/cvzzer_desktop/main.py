from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any

from PyQt6.QtCore import Qt
from PyQt6.QtGui import QAction
from PyQt6.QtWidgets import (
    QApplication,
    QFileDialog,
    QFormLayout,
    QLabel,
    QLineEdit,
    QListWidget,
    QListWidgetItem,
    QMainWindow,
    QMessageBox,
    QPlainTextEdit,
    QPushButton,
    QScrollArea,
    QSplitter,
    QTabWidget,
    QVBoxLayout,
    QWidget,
)

from .database import CVRepository
from .latex import render_latex


TEXT_FIELDS = {
    'resume': 'Profil / résumé',
    'skills': 'Compétences',
    'experience': 'Expériences',
    'education': 'Formation',
    'job_offer': 'Offre visée',
}


class CVEditor(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.name = QLineEdit()
        self.full_name = QLineEdit()
        self.title = QLineEdit()
        self.email = QLineEdit()
        self.phone = QLineEdit()
        self.location = QLineEdit()
        self.linkedin = QLineEdit()
        self.text_fields = {key: QPlainTextEdit() for key in TEXT_FIELDS}

        form = QFormLayout()
        form.addRow('Nom du document', self.name)
        form.addRow('Nom complet', self.full_name)
        form.addRow('Titre professionnel', self.title)
        form.addRow('E-mail', self.email)
        form.addRow('Téléphone', self.phone)
        form.addRow('Ville / pays', self.location)
        form.addRow('LinkedIn / site', self.linkedin)

        layout = QVBoxLayout(self)
        layout.addLayout(form)
        for key, label in TEXT_FIELDS.items():
            layout.addWidget(QLabel(label))
            editor = self.text_fields[key]
            editor.setPlaceholderText(f'Saisissez {label.lower()}…')
            editor.setMinimumHeight(95)
            layout.addWidget(editor)

    def payload(self) -> dict[str, Any]:
        return {
            'name': self.name.text(),
            'full_name': self.full_name.text(),
            'title': self.title.text(),
            'email': self.email.text(),
            'phone': self.phone.text(),
            'location': self.location.text(),
            'linkedin': self.linkedin.text(),
            **{key: editor.toPlainText() for key, editor in self.text_fields.items()},
        }

    def set_payload(self, payload: dict[str, Any]) -> None:
        for key in ('name', 'full_name', 'title', 'email', 'phone', 'location', 'linkedin'):
            getattr(self, key).setText(str(payload.get(key, '')))
        for key, editor in self.text_fields.items():
            editor.setPlainText(str(payload.get(key, '')))

    def clear(self) -> None:
        self.set_payload({})


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__()
        self.repository = CVRepository()
        self.document_id: int | None = None
        self.setWindowTitle('CVzzer Desktop')
        self.resize(1250, 780)

        self.editor = CVEditor()
        self.preview = QPlainTextEdit()
        self.preview.setReadOnly(True)
        self.preview.setLineWrapMode(QPlainTextEdit.LineWrapMode.NoWrap)

        self.documents = QListWidget()
        self.documents.itemSelectionChanged.connect(self.load_selected_document)
        self._create_actions()
        self._create_layout()
        self.refresh_documents()
        self.new_document()
        self.statusBar().showMessage('Prêt — stockage local SQLite')

    def _create_actions(self) -> None:
        toolbar = self.addToolBar('Actions')
        for text, handler in (
            ('Nouveau', self.new_document),
            ('Sauvegarder', self.save_document),
            ('Supprimer', self.delete_document),
            ('Actualiser LaTeX', self.refresh_preview),
            ('Exporter .tex', self.export_tex),
            ('Exporter PDF', self.export_pdf),
        ):
            action = QAction(text, self)
            action.triggered.connect(handler)
            toolbar.addAction(action)

    def _create_layout(self) -> None:
        left = QWidget()
        left_layout = QVBoxLayout(left)
        left_layout.addWidget(QLabel('CV enregistrés'))
        left_layout.addWidget(self.documents)
        save_button = QPushButton('Sauvegarder le CV')
        save_button.clicked.connect(self.save_document)
        left_layout.addWidget(save_button)

        editor_container = QScrollArea()
        editor_container.setWidgetResizable(True)
        editor_container.setWidget(self.editor)

        tabs = QTabWidget()
        tabs.addTab(editor_container, 'Édition')
        tabs.addTab(self.preview, 'Aperçu LaTeX')

        splitter = QSplitter(Qt.Orientation.Horizontal)
        splitter.addWidget(left)
        splitter.addWidget(tabs)
        splitter.setSizes([260, 990])
        self.setCentralWidget(splitter)

    def refresh_documents(self, selected_id: int | None = None) -> None:
        self.documents.blockSignals(True)
        self.documents.clear()
        for document in self.repository.list_documents():
            item = QListWidgetItem(f'{document.name}\n{document.updated_at[:16].replace("T", " ")}')
            item.setData(Qt.ItemDataRole.UserRole, document.id)
            self.documents.addItem(item)
            if document.id == selected_id:
                self.documents.setCurrentItem(item)
        self.documents.blockSignals(False)

    def new_document(self) -> None:
        self.document_id = None
        self.documents.clearSelection()
        self.editor.clear()
        self.editor.name.setText('Nouveau CV')
        self.refresh_preview()
        self.statusBar().showMessage('Nouveau CV local')

    def load_selected_document(self) -> None:
        item = self.documents.currentItem()
        if item is None:
            return
        document_id = item.data(Qt.ItemDataRole.UserRole)
        payload = self.repository.load(int(document_id))
        if payload is None:
            return
        self.document_id = int(document_id)
        self.editor.set_payload(payload)
        self.refresh_preview()
        self.statusBar().showMessage('CV chargé depuis SQLite')

    def save_document(self) -> None:
        payload = self.editor.payload()
        self.document_id = self.repository.save(self.document_id, payload['name'], payload)
        self.refresh_documents(self.document_id)
        self.statusBar().showMessage('CV sauvegardé localement', 4000)

    def delete_document(self) -> None:
        if self.document_id is None:
            return
        confirmation = QMessageBox.question(
            self,
            'Supprimer ce CV',
            'Supprimer définitivement ce CV de la base SQLite locale ?',
        )
        if confirmation != QMessageBox.StandardButton.Yes:
            return
        self.repository.delete(self.document_id)
        self.refresh_documents()
        self.new_document()
        self.statusBar().showMessage('CV supprimé', 4000)

    def refresh_preview(self) -> None:
        self.preview.setPlainText(render_latex(self.editor.payload()))

    def export_tex(self) -> None:
        self.refresh_preview()
        filename, _ = QFileDialog.getSaveFileName(self, 'Exporter le fichier LaTeX', 'cv.tex', 'LaTeX (*.tex)')
        if filename:
            Path(filename).write_text(self.preview.toPlainText(), encoding='utf-8')
            self.statusBar().showMessage('Fichier LaTeX exporté', 4000)

    def export_pdf(self) -> None:
        pdflatex = shutil.which('pdflatex')
        if not pdflatex:
            QMessageBox.warning(self, 'pdflatex introuvable', 'Installez une distribution LaTeX puis relancez l’export PDF.')
            return
        filename, _ = QFileDialog.getSaveFileName(self, 'Exporter le PDF', 'cv.pdf', 'PDF (*.pdf)')
        if not filename:
            return
        self.refresh_preview()
        with tempfile.TemporaryDirectory(prefix='cvzzer_') as directory:
            work_dir = Path(directory)
            tex_path = work_dir / 'cv.tex'
            tex_path.write_text(self.preview.toPlainText(), encoding='utf-8')
            result = subprocess.run(
                [pdflatex, '-interaction=nonstopmode', '-halt-on-error', tex_path.name],
                cwd=work_dir,
                capture_output=True,
                text=True,
                check=False,
            )
            pdf_path = work_dir / 'cv.pdf'
            if result.returncode != 0 or not pdf_path.exists():
                QMessageBox.critical(self, 'Export PDF impossible', result.stdout[-1800:] or result.stderr[-1800:])
                return
            Path(filename).write_bytes(pdf_path.read_bytes())
        self.statusBar().showMessage('PDF exporté', 4000)

    def closeEvent(self, event) -> None:  # type: ignore[override]
        self.repository.close()
        event.accept()


def run() -> None:
    application = QApplication(sys.argv)
    application.setApplicationName('CVzzer Desktop')
    window = MainWindow()
    window.show()
    sys.exit(application.exec())
