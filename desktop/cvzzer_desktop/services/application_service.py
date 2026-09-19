from __future__ import annotations

from ..models import JobOfferAnalysis
from .job_offer_service import analyse_offer


def adapt_profile(profile: dict[str, str], offer_text: str) -> tuple[JobOfferAnalysis, dict[str, str], str]:
    """Creates truthful application material using only the saved candidate profile."""
    analysis = analyse_offer(offer_text)
    profile_text = ' '.join(str(value) for value in profile.values()).lower()
    relevant_skills = [skill for skill in analysis.skills if skill in profile_text]
    adapted = dict(profile)
    if relevant_skills:
        adapted['skills'] = ', '.join(relevant_skills)
    adapted['job_offer'] = f"{analysis.title}\n\nMots-clés pertinents : {', '.join(relevant_skills or analysis.skills)}"
    full_name = profile.get('full_name') or 'Le candidat'
    company = profile.get('company_name') or 'votre entreprise'
    cover_letter = (
        f"Objet : Candidature au poste de {analysis.title}\n\n"
        f"Madame, Monsieur,\n\n"
        f"Je vous adresse ma candidature pour le poste de {analysis.title} au sein de {company}. "
        f"Mon profil met en avant les éléments suivants : {profile.get('skills') or 'compétences renseignées dans mon CV'}.\n\n"
        "Vous trouverez ci-joint mon CV, adapté pour mettre en évidence les expériences et compétences pertinentes présentes dans mon profil. "
        "Je serais heureux(se) d’échanger avec vous sur ma candidature.\n\n"
        f"Cordialement,\n{full_name}"
    )
    return analysis, adapted, cover_letter
