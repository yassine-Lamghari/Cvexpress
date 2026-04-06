import { StateCreator } from 'zustand';
import { CVData } from '@/types/cv';
import { CVStore } from '../cv-store';

export interface ProfileSlice {
  cvData: CVData;
  setCVData: (data: Partial<CVData>) => void;
  setPersonalInfo: (info: Partial<CVData['personalInfo']>) => void;
  addExperience: (exp: CVData['experiences'][0]) => void;
  removeExperience: (id: string) => void;
  updateExperience: (id: string, exp: Partial<CVData['experiences'][0]>) => void;
  addStage: (stage: CVData['stages'][0]) => void;
  removeStage: (id: string) => void;
  updateStage: (id: string, stage: Partial<CVData['stages'][0]>) => void;
  addEducation: (edu: CVData['education'][0]) => void;
  removeEducation: (id: string) => void;
  updateEducation: (id: string, edu: Partial<CVData['education'][0]>) => void;
  addSkill: (skill: CVData['skills'][0]) => void;
  removeSkill: (name: string) => void;
  addLanguage: (lang: CVData['languages'][0]) => void;
  removeLanguage: (name: string) => void;
  addCertification: (cert: CVData['certifications'][0]) => void;
  removeCertification: (name: string) => void;
}

export const emptyCVData: CVData = {
  personalInfo: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    city: '',
    country: '',
    linkedin: '',
    website: '',
    title: '',
    photo: '',
  },
  summary: '',
  experiences: [],
  stages: [],
  education: [],
  skills: [],
  languages: [],
  certifications: [],
};

export const createProfileSlice: StateCreator<CVStore, [], [], ProfileSlice> = (set) => ({
  cvData: emptyCVData,

  setCVData: (data) =>
    set((state) => ({ cvData: { ...state.cvData, ...data } })),

  setPersonalInfo: (info) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        personalInfo: { ...state.cvData.personalInfo, ...info },
      },
    })),

  addExperience: (exp) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        experiences: [...state.cvData.experiences, exp],
      },
    })),

  removeExperience: (id) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        experiences: state.cvData.experiences.filter((e) => e.id !== id),
      },
    })),

  updateExperience: (id, exp) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        experiences: state.cvData.experiences.map((e) =>
          e.id === id ? { ...e, ...exp } : e
        ),
      },
    })),

  addStage: (stage) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        stages: [...state.cvData.stages, stage],
      },
    })),

  removeStage: (id) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        stages: state.cvData.stages.filter((s) => s.id !== id),
      },
    })),

  updateStage: (id, stage) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        stages: state.cvData.stages.map((s) =>
          s.id === id ? { ...s, ...stage } : s
        ),
      },
    })),

  addEducation: (edu) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        education: [...state.cvData.education, edu],
      },
    })),

  removeEducation: (id) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        education: state.cvData.education.filter((e) => e.id !== id),
      },
    })),

  updateEducation: (id, edu) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        education: state.cvData.education.map((e) =>
          e.id === id ? { ...e, ...edu } : e
        ),
      },
    })),

  addSkill: (skill) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        skills: [...state.cvData.skills, skill],
      },
    })),

  removeSkill: (name) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        skills: state.cvData.skills.filter((s) => s.name !== name),
      },
    })),

  addLanguage: (lang) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        languages: [...state.cvData.languages, lang],
      },
    })),

  removeLanguage: (name) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        languages: state.cvData.languages.filter((l) => l.name !== name),
      },
    })),

  addCertification: (cert) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        certifications: [...state.cvData.certifications, cert],
      },
    })),

  removeCertification: (name) =>
    set((state) => ({
      cvData: {
        ...state.cvData,
        certifications: state.cvData.certifications.filter((c) => c.name !== name),
      },
    })),
});
