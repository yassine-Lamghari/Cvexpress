# CVzzer Desktop

Application locale PyQt6 indépendante de l'application Next.js/Docker. Les CV sont enregistrés dans une base SQLite sur le poste, sans compte ni service Supabase.

## Prérequis

- Python 3.10 ou plus récent
- `pdflatex` installé, uniquement pour l'export PDF

## Démarrer

Depuis la racine du dépôt :

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r desktop\requirements.txt
python desktop\run.py
```

Les données locales sont stockées dans le répertoire applicatif de l'utilisateur, sous le fichier `cvzzer.sqlite3`.

## Workflows

### Candidature à partir d’une offre

Un assistant guide le candidat à travers : profil SQLite → offre collée ou importée → analyse des mots-clés → CV adapté → lettre → contrôle de l’email → envoi SMTP.

Le CV et la lettre sont générés exclusivement depuis le profil sauvegardé. Les compétences non présentes dans le profil ne sont jamais ajoutées.

### Candidature sans offre

Le second assistant joint uniquement le CV (PDF ou DOCX). La lettre de motivation est rédigée directement dans le corps du mail et n’est pas demandée comme fichier PDF.

Le destinataire peut être saisi directement avec l’e-mail et le nom de l’entreprise, ou provenir d’un fichier `.xlsx`, `.xlsm` ou `.csv`. L’application contrôle les adresses, retire les doublons, prévisualise les cinq premiers messages et envoie les e-mails un à un.

Les variables `{{company}}`, `{{contact_name}}` et `{{position}}` sont disponibles dans l’objet et le corps du message.

## Configuration SMTP

Les identifiants ne sont jamais enregistrés dans SQLite et ne doivent pas être ajoutés au code. Définissez-les dans votre session Windows avant de lancer l’application :

```powershell
$env:SMTP_HOST = "smtp.example.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "utilisateur@example.com"
$env:SMTP_PASS = "mot-de-passe-ou-mot-de-passe-app"
$env:SMTP_FROM_EMAIL = "utilisateur@example.com"
$env:SMTP_FROM_NAME = "Votre nom"
```

Ajoutez `$env:SMTP_USE_SSL = "true"` pour un serveur SMTP SSL implicite. Sans cette configuration, l’application reste utilisable mais bloque l’envoi avec une erreur explicite.

## Garanties locales

- profil, brouillons et journal d’envoi dans SQLite ;
- protections contre emails invalides, doublons dans le fichier, et renvois identiques déjà marqués `Sent` ;
- statuts enregistrés : `Sending`, `Sent`, `Failed`, `Skipped` ;
- aucun compte, Supabase ou authentification requis.
