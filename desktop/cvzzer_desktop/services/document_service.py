from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

from ..latex import escape_latex


def cover_letter_latex(content: str) -> str:
    escaped = escape_latex(content).replace('\n', '\n\n')
    return f'''\\documentclass[11pt,a4paper]{{article}}
\\usepackage[margin=2.5cm]{{geometry}}
\\usepackage[T1]{{fontenc}}
\\usepackage[utf8]{{inputenc}}
\\usepackage[french]{{babel}}
\\setlength{{\\parindent}}{{0pt}}
\\begin{{document}}
{escaped}
\\end{{document}}
'''


def export_pdf(latex: str, destination: str | Path) -> None:
    pdflatex = shutil.which('pdflatex')
    if not pdflatex:
        raise RuntimeError('pdflatex est introuvable. Installez MiKTeX ou TeX Live pour exporter en PDF.')
    with tempfile.TemporaryDirectory(prefix='cvzzer_') as directory:
        work_dir = Path(directory)
        source = work_dir / 'document.tex'
        source.write_text(latex, encoding='utf-8')
        result = subprocess.run(
            [pdflatex, '-interaction=nonstopmode', '-halt-on-error', source.name],
            cwd=work_dir, capture_output=True, text=True, check=False,
        )
        compiled = work_dir / 'document.pdf'
        if result.returncode != 0 or not compiled.is_file():
            raise RuntimeError(result.stdout[-1800:] or result.stderr[-1800:] or 'La compilation PDF a échoué.')
        Path(destination).write_bytes(compiled.read_bytes())
