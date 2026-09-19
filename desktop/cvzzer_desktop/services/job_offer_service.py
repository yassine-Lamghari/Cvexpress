from __future__ import annotations

import re

from ..models import JobOfferAnalysis


KNOWN_SKILLS = {
    'python', 'java', 'javascript', 'typescript', 'react', 'next.js', 'node.js', 'sql', 'mysql',
    'postgresql', 'docker', 'kubernetes', 'aws', 'azure', 'git', 'linux', 'figma', 'excel',
    'power bi', 'machine learning', 'tensorflow', 'pytorch', 'django', 'flask', 'fastapi',
}
KNOWN_LANGUAGES = {'français', 'anglais', 'french', 'english', 'arabic', 'arabe', 'espagnol', 'spanish'}


def analyse_offer(text: str) -> JobOfferAnalysis:
    lines = [line.strip(' -•\t') for line in text.splitlines() if line.strip()]
    searchable = text.lower()
    title = lines[0] if lines else 'Poste non identifié'
    title_match = re.search(r'(?:poste|position|job|stage)\s*[:\-]\s*(.+)', text, re.IGNORECASE)
    if title_match:
        title = title_match.group(1).strip()

    skills = sorted(skill for skill in KNOWN_SKILLS if skill in searchable)
    languages = sorted(language for language in KNOWN_LANGUAGES if language in searchable)
    years = re.search(r'\b(\d+\+?\s*(?:ans?|years?))\b', searchable)
    missions = [line for line in lines if any(word in line.lower() for word in ('mission', 'responsab', 'vous serez', 'tâche'))][:5]
    keywords = list(dict.fromkeys(skills + languages + re.findall(r'\b[A-Za-z][A-Za-z+.#-]{3,}\b', text)))[:25]
    return JobOfferAnalysis(title, keywords, skills, languages, years.group(1) if years else '', missions)
