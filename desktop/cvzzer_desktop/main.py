from __future__ import annotations

import hashlib
import sys
from pathlib import Path

from PyQt6.QtCore import Qt
from PyQt6.QtWidgets import (
    QApplication, QFileDialog, QFormLayout, QHBoxLayout, QLabel, QLineEdit,
    QMainWindow, QMessageBox, QPlainTextEdit, QProgressDialog, QPushButton,
    QScrollArea, QStackedWidget, QVBoxLayout, QWidget, QWizard, QWizardPage,
)

from .database import CVRepository
from .latex import render_latex
from .models import Contact
from .services.application_service import adapt_profile
from .services.contact_import_service import import_contacts
from .services.document_service import cover_letter_latex, export_pdf
from .services.email_service import SMTPEmailService
from .services.template_service import personalise


TEXT_FIELDS = {
    'summary': 'Résumé professionnel', 'education': 'Parcours académique',
    'experience': 'Expériences', 'internships': 'Stages', 'projects': 'Projets',
    'skills': 'Compétences techniques', 'certifications': 'Certifications', 'languages': 'Langues',
}


APP_STYLESHEET = """
QMainWindow, QWidget, QWizard, QWizardPage {
    background-color: #0F172A;
    color: #E2E8F0;
    font-size: 14px;
}
QLabel {
    background-color: transparent;
    color: #E2E8F0;
}
QLabel#title {
    color: #F8FAFC;
    font-size: 30px;
    font-weight: 700;
}
QPushButton {
    background-color: #F8FAFC;
    border: 1px solid #94A3B8;
    border-radius: 10px;
    color: #0F172A;
    padding: 12px;
}
QPushButton:hover {
    background-color: #DBEAFE;
    border-color: #38BDF8;
}
QPushButton:pressed {
    background-color: #BFDBFE;
}
QPushButton:disabled {
    background-color: #CBD5E1;
    color: #64748B;
}
QPushButton#workflowCard {
    font-size: 16px;
    font-weight: 600;
}
QLineEdit, QPlainTextEdit {
    background-color: #FFFFFF;
    border: 1px solid #94A3B8;
    border-radius: 6px;
    color: #0F172A;
    padding: 6px;
    selection-background-color: #2563EB;
    selection-color: #FFFFFF;
}
QScrollArea, QScrollArea > QWidget > QWidget {
    background-color: #0F172A;
}
QStatusBar {
    background-color: #111827;
    color: #CBD5E1;
}
QToolTip {
    background-color: #F8FAFC;
    border: 1px solid #94A3B8;
    color: #0F172A;
}
"""


def select_file(parent: QWidget, title: str, filters: str) -> str:
    return QFileDialog.getOpenFileName(parent, title, '', filters)[0]


def save_file(parent: QWidget, title: str, filename: str, content: str, filters: str) -> str:
    path = QFileDialog.getSaveFileName(parent, title, filename, filters)[0]
    if path:
        Path(path).write_text(content, encoding='utf-8')
    return path


class ProfileForm(QWidget):
    def __init__(self) -> None:
        super().__init__()
        self.lines = {field: QLineEdit() for field in ('full_name', 'title', 'email', 'phone', 'location', 'linkedin')}
        self.areas = {field: QPlainTextEdit() for field in TEXT_FIELDS}
        labels = {'full_name': 'Nom complet', 'title': 'Titre professionnel', 'email': 'E-mail', 'phone': 'Téléphone', 'location': 'Ville / pays', 'linkedin': 'LinkedIn / site'}
        form = QFormLayout()
        for field, label in labels.items(): form.addRow(label, self.lines[field])
        layout = QVBoxLayout(self); layout.addLayout(form)
        for field, label in TEXT_FIELDS.items():
            layout.addWidget(QLabel(label)); self.areas[field].setMinimumHeight(75); layout.addWidget(self.areas[field])

    def data(self) -> dict[str, str]:
        return {**{key: item.text().strip() for key, item in self.lines.items()}, **{key: item.toPlainText().strip() for key, item in self.areas.items()}}

    def load(self, values: dict[str, str]) -> None:
        for key, item in self.lines.items(): item.setText(values.get(key, ''))
        for key, item in self.areas.items(): item.setPlainText(values.get(key, ''))


class OfferWizard(QWizard):
    def __init__(self, repository: CVRepository) -> None:
        super().__init__(); self.repository = repository
        self.setWindowTitle('Candidature à partir d’une offre')
        self.profile = ProfileForm(); self.offer = QPlainTextEdit(); self.analysis_view = QPlainTextEdit(); self.cv_view = QPlainTextEdit(); self.letter_view = QPlainTextEdit()
        self.analysis_view.setReadOnly(True); self.cv_view.setReadOnly(True); self.letter_view.setReadOnly(True)
        self.cv_attachment = ''; self.letter_attachment = ''
        self.addPage(self._profile_page()); self.addPage(self._offer_page()); self.addPage(self._analysis_page()); self.addPage(self._documents_page()); self.addPage(self._email_page())

    def _profile_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('1. Profil candidat'); page.setSubTitle('Le profil sauvegardé est la seule source de vérité : aucune information ne sera inventée.')
        page.registerField('profile_complete*', self.profile.lines['full_name'])
        self.profile.load(self.repository.load_profile())
        scroll = QScrollArea(); scroll.setWidgetResizable(True); scroll.setWidget(self.profile)
        layout = QVBoxLayout(page); layout.addWidget(scroll)
        return page

    def _offer_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('2. Offre à analyser')
        self.offer.setPlaceholderText('Collez le texte de l’offre d’emploi ou du stage…')
        button = QPushButton('Importer une offre texte')
        button.clicked.connect(lambda: self._import_offer())
        layout = QVBoxLayout(page); layout.addWidget(button); layout.addWidget(self.offer)
        return page

    def _analysis_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('3. Analyse de l’offre'); layout = QVBoxLayout(page); layout.addWidget(self.analysis_view); return page

    def _documents_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('4. CV adapté et lettre')
        cv_export = QPushButton('Exporter le CV adapté (.tex)'); cv_export.clicked.connect(self._export_cv)
        cv_pdf_export = QPushButton('Exporter le CV adapté (.pdf)'); cv_pdf_export.clicked.connect(self._export_cv_pdf)
        letter_export = QPushButton('Exporter la lettre (.txt)'); letter_export.clicked.connect(self._export_letter)
        letter_pdf_export = QPushButton('Exporter la lettre (.pdf)'); letter_pdf_export.clicked.connect(self._export_letter_pdf)
        layout = QVBoxLayout(page); layout.addWidget(QLabel('CV adapté')) ; layout.addWidget(self.cv_view); layout.addWidget(cv_export); layout.addWidget(cv_pdf_export); layout.addWidget(QLabel('Lettre de motivation')); layout.addWidget(self.letter_view); layout.addWidget(letter_export); layout.addWidget(letter_pdf_export)
        return page

    def _email_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('5. Vérification avant envoi')
        self.recipient = QLineEdit(); self.subject = QLineEdit(); self.message = QPlainTextEdit(); self.attachments = QLineEdit()
        attach_button = QPushButton('Ajouter une pièce jointe')
        attach_button.clicked.connect(self._add_attachment)
        form = QFormLayout(); form.addRow('Destinataire', self.recipient); form.addRow('Objet', self.subject); form.addRow('Pièces jointes (;)', self.attachments)
        layout = QVBoxLayout(page); layout.addLayout(form); layout.addWidget(attach_button); layout.addWidget(QLabel('Email')); layout.addWidget(self.message)
        return page

    def _import_offer(self) -> None:
        path = select_file(self, 'Importer une offre', 'Texte (*.txt *.md);;Tous les fichiers (*)')
        if path: self.offer.setPlainText(Path(path).read_text(encoding='utf-8', errors='replace'))

    def _export_cv(self) -> None:
        path = save_file(self, 'Exporter le CV', 'cv-adapte.tex', self.cv_view.toPlainText(), 'LaTeX (*.tex)')
        if path: self.cv_attachment = path; self._set_attachments()

    def _export_letter(self) -> None:
        path = save_file(self, 'Exporter la lettre', 'lettre-motivation.txt', self.letter_view.toPlainText(), 'Texte (*.txt)')
        if path: self.letter_attachment = path; self._set_attachments()

    def _export_cv_pdf(self) -> None:
        path = QFileDialog.getSaveFileName(self, 'Exporter le CV PDF', 'cv-adapte.pdf', 'PDF (*.pdf)')[0]
        if not path: return
        try:
            export_pdf(self.cv_view.toPlainText(), path); self.cv_attachment = path; self._set_attachments()
        except RuntimeError as error:
            QMessageBox.warning(self, 'Export PDF impossible', str(error))

    def _export_letter_pdf(self) -> None:
        path = QFileDialog.getSaveFileName(self, 'Exporter la lettre PDF', 'lettre-motivation.pdf', 'PDF (*.pdf)')[0]
        if not path: return
        try:
            export_pdf(cover_letter_latex(self.letter_view.toPlainText()), path); self.letter_attachment = path; self._set_attachments()
        except RuntimeError as error:
            QMessageBox.warning(self, 'Export PDF impossible', str(error))

    def _add_attachment(self) -> None:
        files, _ = QFileDialog.getOpenFileNames(self, 'Ajouter des pièces jointes')
        self.attachments.setText(';'.join([*filter(None, self.attachments.text().split(';')), *files]))

    def _set_attachments(self) -> None:
        if hasattr(self, 'attachments'): self.attachments.setText(';'.join(filter(None, (self.cv_attachment, self.letter_attachment))))

    def validateCurrentPage(self) -> bool:
        if self.currentId() == 0:
            self.profile_data = self.profile.data()
            if not self.profile_data['full_name'] or not (self.profile_data['summary'] or self.profile_data['experience']):
                QMessageBox.warning(self, 'Profil incomplet', 'Indiquez votre nom et un résumé ou une expérience.'); return False
            self.repository.save_profile(self.profile_data)
        elif self.currentId() == 1:
            self.offer_text = self.offer.toPlainText().strip()
            if len(self.offer_text) < 30: QMessageBox.warning(self, 'Offre incomplète', 'Ajoutez au moins 30 caractères.'); return False
        elif self.currentId() == 4:
            if '@' not in self.recipient.text() or not self.subject.text().strip() or not self.message.toPlainText().strip():
                QMessageBox.warning(self, 'Email incomplet', 'Complétez le destinataire, l’objet et le message.'); return False
        return super().validateCurrentPage()

    def initializePage(self, page_id: int) -> None:
        if page_id == 2:
            self.analysis, self.adapted, self.letter = adapt_profile(self.profile_data, self.offer_text)
            self.analysis_view.setPlainText(f'Titre : {self.analysis.title}\nCompétences demandées : {", ".join(self.analysis.skills) or "Non détectées"}\nLangues : {", ".join(self.analysis.languages) or "Non détectées"}\nExpérience : {self.analysis.experience_level or "Non précisée"}\n\nMots-clés : {", ".join(self.analysis.keywords)}\n\nLes éléments non présents dans votre profil ne sont pas ajoutés au CV.')
        elif page_id == 3:
            self.cv_latex = render_latex(self.adapted); self.cv_view.setPlainText(self.cv_latex); self.letter_view.setPlainText(self.letter)
        elif page_id == 4:
            self.subject.setText(f'Candidature – {self.analysis.title}'); self.message.setPlainText(self.letter); self._set_attachments()

    def accept(self) -> None:
        recipient, subject, body = self.recipient.text().strip(), self.subject.text(), self.message.toPlainText()
        attachments = list(filter(None, self.attachments.text().split(';')))
        if QMessageBox.question(self, 'Confirmer', f'Envoyer à {recipient} ?') != QMessageBox.StandardButton.Yes: return
        fingerprint = hashlib.sha256((subject + body + '|'.join(attachments)).encode()).hexdigest()
        if self.repository.delivery_exists(fingerprint, recipient): QMessageBox.information(self, 'Envoi évité', 'Cette candidature a déjà été envoyée.'); return
        try:
            self.repository.record_delivery(fingerprint, recipient, 'Sending'); SMTPEmailService().send(recipient, subject, body, attachments); self.repository.record_delivery(fingerprint, recipient, 'Sent'); QMessageBox.information(self, 'Envoyé', 'Candidature envoyée avec succès.'); super().accept()
        except Exception as error:
            self.repository.record_delivery(fingerprint, recipient, 'Failed', str(error)); QMessageBox.critical(self, 'Erreur SMTP', str(error))


class CampaignWizard(QWizard):
    def __init__(self, repository: CVRepository) -> None:
        super().__init__(); self.repository = repository; self.contacts: list[Contact] = []
        self.setWindowTitle('Candidature vers une base de contacts')
        self.addPage(self._files_page()); self.addPage(self._contacts_page()); self.addPage(self._email_page()); self.addPage(self._preview_page())

    def _files_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('1. CV et lettre existants'); self.cv_file = QLineEdit(); self.letter_file = QLineEdit()
        form = QFormLayout(page)
        for label, target in (('CV (PDF ou DOCX)', self.cv_file), ('Lettre (PDF ou DOCX)', self.letter_file)):
            row = QWidget(); layout = QHBoxLayout(row); layout.setContentsMargins(0, 0, 0, 0); browse = QPushButton('Parcourir'); browse.clicked.connect(lambda _, input_=target: input_.setText(select_file(page, 'Sélectionner un document', 'Documents (*.pdf *.docx)'))); layout.addWidget(target); layout.addWidget(browse); form.addRow(label, row)
        return page

    def _contacts_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('2. Base de contacts Excel'); self.contact_file = QLineEdit(); self.contact_report = QPlainTextEdit(); self.contact_report.setReadOnly(True)
        browse = QPushButton('Importer .xlsx ou .csv'); browse.clicked.connect(self._load_contacts)
        layout = QVBoxLayout(page); layout.addWidget(self.contact_file); layout.addWidget(browse); layout.addWidget(self.contact_report); return page

    def _email_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('3. Configurer les emails'); self.campaign_subject = QLineEdit('Candidature spontanée'); self.sender_name = QLineEdit(); self.campaign_body = QPlainTextEdit('Bonjour {{contact_name}},\n\nJe vous transmets ma candidature pour une opportunité au sein de {{company}}.\n\nCordialement,\n{{sender_name}}')
        form = QFormLayout(); form.addRow('Nom expéditeur', self.sender_name); form.addRow('Objet', self.campaign_subject)
        layout = QVBoxLayout(page); layout.addLayout(form); layout.addWidget(QLabel('Variables : {{company}}, {{contact_name}}, {{position}}')); layout.addWidget(self.campaign_body); return page

    def _preview_page(self) -> QWizardPage:
        page = QWizardPage(); page.setTitle('4. Prévisualisation'); self.campaign_preview = QPlainTextEdit(); self.campaign_preview.setReadOnly(True); QVBoxLayout(page).addWidget(self.campaign_preview); return page

    def _load_contacts(self) -> None:
        path = select_file(self, 'Importer les contacts', 'Contacts (*.xlsx *.xlsm *.csv)')
        if not path: return
        self.contact_file.setText(path); result = import_contacts(path); self.contacts = result.contacts
        self.contact_report.setPlainText(f'{len(result.contacts)} email(s) valide(s)\n{result.duplicates} doublon(s) supprimé(s)\n\n' + '\n'.join(result.errors[:50]))

    def validateCurrentPage(self) -> bool:
        if self.currentId() == 0 and (not self.cv_file.text() or not self.letter_file.text()): QMessageBox.warning(self, 'Documents requis', 'Ajoutez le CV et la lettre.'); return False
        if self.currentId() == 1 and not self.contacts: QMessageBox.warning(self, 'Contacts requis', 'Importez au moins un contact valide.'); return False
        if self.currentId() == 2 and (not self.campaign_subject.text().strip() or not self.campaign_body.toPlainText().strip()): QMessageBox.warning(self, 'Email incomplet', 'Ajoutez un objet et un message.'); return False
        return super().validateCurrentPage()

    def initializePage(self, page_id: int) -> None:
        if page_id == 3:
            examples = []
            for contact in self.contacts[:5]: examples.append(f'À : {contact.email}\nObjet : {personalise(self.campaign_subject.text(), contact)}\n{personalise(self.campaign_body.toPlainText(), contact).replace("{{sender_name}}", self.sender_name.text())}')
            self.campaign_preview.setPlainText(f'Destinataires : {len(self.contacts)}\nPièces jointes : {self.cv_file.text()}, {self.letter_file.text()}\n\n' + '\n\n---\n\n'.join(examples))

    def accept(self) -> None:
        if QMessageBox.question(self, 'Confirmer la campagne', f'Envoyer {len(self.contacts)} email(s) ?') != QMessageBox.StandardButton.Yes: return
        progress = QProgressDialog('Envoi en cours…', 'Annuler', 0, len(self.contacts), self); progress.setWindowModality(Qt.WindowModality.WindowModal)
        service, report, attachments = SMTPEmailService(), [], [self.cv_file.text(), self.letter_file.text()]
        for index, contact in enumerate(self.contacts, 1):
            if progress.wasCanceled(): report.append('Campagne interrompue.'); break
            subject = personalise(self.campaign_subject.text(), contact); body = personalise(self.campaign_body.toPlainText(), contact).replace('{{sender_name}}', self.sender_name.text())
            fingerprint = hashlib.sha256((subject + body + '|'.join(attachments)).encode()).hexdigest()
            if self.repository.delivery_exists(fingerprint, contact.email): report.append(f'{contact.email} — Skipped')
            else:
                try: self.repository.record_delivery(fingerprint, contact.email, 'Sending'); service.send(contact.email, subject, body, attachments); self.repository.record_delivery(fingerprint, contact.email, 'Sent'); report.append(f'{contact.email} — Sent')
                except Exception as error: self.repository.record_delivery(fingerprint, contact.email, 'Failed', str(error)); report.append(f'{contact.email} — Failed : {error}')
            progress.setValue(index); QApplication.processEvents()
        QMessageBox.information(self, 'Rapport', '\n'.join(report[:100])); super().accept()


class MainWindow(QMainWindow):
    def __init__(self) -> None:
        super().__init__(); self.repository = CVRepository(); self.setWindowTitle('CVzzer — Candidature Assistant'); self.resize(900, 620)
        home = QWidget(); layout = QVBoxLayout(home); layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        title = QLabel('CANDIDATURE ASSISTANT'); title.setAlignment(Qt.AlignmentFlag.AlignCenter); title.setObjectName('title')
        subtitle = QLabel('Choisissez votre workflow'); subtitle.setAlignment(Qt.AlignmentFlag.AlignCenter)
        layout.addWidget(title); layout.addWidget(subtitle)
        cards = QHBoxLayout()
        for text, callback in [('📄  AVEC OFFRE\n\nAdapter mon CV à une offre et préparer une candidature ciblée.', self.open_offer), ('📧  SANS OFFRE\n\nEnvoyer un CV et une lettre à une base de contacts.', self.open_campaign)]:
            button = QPushButton(text); button.setObjectName('workflowCard'); button.setMinimumSize(320, 190); button.clicked.connect(callback); cards.addWidget(button)
        layout.addLayout(cards); self.setCentralWidget(home); self.statusBar().showMessage('SQLite local — aucun compte requis')

    def open_offer(self) -> None: OfferWizard(self.repository).exec()
    def open_campaign(self) -> None: CampaignWizard(self.repository).exec()
    def closeEvent(self, event) -> None: self.repository.close(); event.accept()


def run() -> None:
    app = QApplication(sys.argv); app.setApplicationName('CVzzer Desktop'); app.setStyle('Fusion'); app.setStyleSheet(APP_STYLESHEET); window = MainWindow(); window.show(); sys.exit(app.exec())
