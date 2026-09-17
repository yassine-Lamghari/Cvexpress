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

## Fonctionnalités

- saisie des informations, compétences, expériences et offre visée ;
- sauvegarde, ouverture et suppression de CV dans SQLite ;
- aperçu LaTeX généré localement ;
- export `.tex` et export PDF lorsque `pdflatex` est disponible.
