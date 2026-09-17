from __future__ import annotations

from typing import Any


LATEX_ESCAPES = {
    '\\': r'\textbackslash{}',
    '&': r'\&',
    '%': r'\%',
    '$': r'\$',
    '#': r'\#',
    '_': r'\_',
    '{': r'\{',
    '}': r'\}',
    '~': r'\textasciitilde{}',
    '^': r'\textasciicircum{}',
}


def escape_latex(value: str) -> str:
    return ''.join(LATEX_ESCAPES.get(character, character) for character in value)


def paragraph(value: str) -> str:
    return escape_latex(value).replace('\n', '\n\n')


def render_latex(data: dict[str, Any]) -> str:
    full_name = escape_latex(data.get('full_name', '') or 'CV sans titre')
    title = escape_latex(data.get('title', ''))
    contact = ' · '.join(
        escape_latex(data.get(field, ''))
        for field in ('email', 'phone', 'location', 'linkedin')
        if data.get(field)
    )
    skills = escape_latex(data.get('skills', ''))
    experience = paragraph(data.get('experience', ''))
    education = paragraph(data.get('education', ''))
    resume = paragraph(data.get('resume', ''))
    job_offer = paragraph(data.get('job_offer', ''))

    sections = [
        ('Profil', resume),
        ('Compétences', skills),
        ('Expérience', experience),
        ('Formation', education),
        ('Offre visée', job_offer),
    ]
    rendered_sections = '\n'.join(
        f'\\section*{{{heading}}}\n{content}'
        for heading, content in sections
        if content
    )

    return f'''\\documentclass[11pt,a4paper]{{article}}
\\usepackage[margin=2cm]{{geometry}}
\\usepackage[T1]{{fontenc}}
\\usepackage[utf8]{{inputenc}}
\\usepackage[french]{{babel}}
\\usepackage{{lmodern}}
\\setlength{{\\parindent}}{{0pt}}
\\begin{{document}}
\\begin{{center}}
  {{\\LARGE\\textbf{{{full_name}}}}}\\\\
  {{\\large {title}}}\\\\
  \\small {contact}
\\end{{center}}

{rendered_sections}
\\end{{document}}
'''
