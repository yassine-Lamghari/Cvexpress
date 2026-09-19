from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class Contact:
    email: str
    company: str = ''
    contact_name: str = ''
    position: str = ''

    def variables(self) -> dict[str, str]:
        return {
            'email': self.email,
            'company': self.company,
            'contact_name': self.contact_name or 'Madame, Monsieur',
            'position': self.position,
        }


@dataclass(frozen=True)
class JobOfferAnalysis:
    title: str
    keywords: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    experience_level: str = ''
    missions: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class DeliveryResult:
    email: str
    status: str
    detail: str = ''
