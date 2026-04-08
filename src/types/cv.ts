export interface PersonalInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  linkedin?: string;
  website?: string;
  title?: string; // e.g. "Développeur Full Stack"
  photo?: string; // base64 data URL
}

export interface Experience {
  id: string;
  jobTitle: string;
  company: string;
  location?: string;
  startDate: string;
  endDate: string; // or "Présent" / "Present"
  description: string;
  highlights?: string[];
}

export interface Education {
  id: string;
  degree: string;
  school: string;
  location?: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface Skill {
  name: string;
  level?: 'débutant' | 'intermédiaire' | 'avancé' | 'expert' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
}

export interface Language {
  name: string;
  level: string; // e.g. "Courant", "Natif", "B2"
}

export interface Certification {
  name: string;
  issuer: string;
  date?: string;
}

export interface CVData {
  personalInfo: PersonalInfo;
  summary: string;
  experiences: Experience[];
  stages: Experience[];
  education: Education[];
  skills: Skill[];
  languages: Language[];
  certifications: Certification[];
}

export interface GeneratedOutput {
  adaptedCV: CVData;
  motivationLetter: string;
  candidacyEmail: string;
  latexCode?: string;
}

export interface SendApplicationPayload {
  recipientEmail: string;
  recipientName?: string;
  companyName?: string;
  subject: string;
  emailBody: string;
  candidateEmail: string;
  candidateFullName: string;
  template: string;
  latexCode: string;
  photo?: string;
  motivationLetter: string;
  includeCvPdf: boolean;
  includeLetterPdf: boolean;
}

export interface TemplateInfo {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  tags: string[];
  primaryColor: string;
}

export type Locale = 'fr' | 'en';

export type BuilderStep = 1 | 2 | 3 | 4 | 5;

export interface JobOffer {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
}
