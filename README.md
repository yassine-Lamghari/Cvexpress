# CVzzer Desktop

Application PyQt6 locale de gestion et d’envoi de candidatures. Cette branche contient uniquement la version desktop ; l’application Next.js/Docker reste disponible sur la branche `main`.

## Fonctionnalités

- workflow guidé à partir d’une offre : profil SQLite, analyse, CV adapté, lettre, vérification et envoi ;
- workflow sans offre : CV joint, lettre rédigée dans le mail, destinataire manuel ou import Excel/CSV, puis envoi progressif ;
- stockage local SQLite, sans compte ni Supabase ;
- prévention des doublons et journal des états `Sending`, `Sent`, `Failed`, `Skipped` ;
- export LaTeX et PDF lorsque `pdflatex` est installé ;
- configuration SMTP exclusivement par variables d’environnement.

## Installation

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r desktop\requirements.txt
python desktop\run.py
```

Le lanceur PowerShell peut également être utilisé :

```powershell
.\start-desktop.ps1
```

## Configuration SMTP

```powershell
$env:SMTP_HOST = "smtp.example.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "utilisateur@example.com"
$env:SMTP_PASS = "mot-de-passe-app"
$env:SMTP_FROM_EMAIL = "utilisateur@example.com"
$env:SMTP_FROM_NAME = "Votre nom"
```

Consultez [desktop/README.md](desktop/README.md) pour le détail des workflows et de la configuration.
