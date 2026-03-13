import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CVData, GeneratedOutput, BuilderStep, Locale } from '@/types/cv';

const emptyCVData: CVData = {
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

interface CVStore {
  // User inputs
  cvData: CVData;
  jobOffer: string;
  rawResume: string;
  rawSkills: string;

  // Builder state
  currentStep: BuilderStep;
  selectedTemplate: string;
  locale: Locale;

  // AI outputs
  generatedOutput: GeneratedOutput | null;
  isGenerating: boolean;
  generationError: string | null;

  // Actions
  setCVData: (data: Partial<CVData>) => void;
  setPersonalInfo: (info: Partial<CVData['personalInfo']>) => void;
  setJobOffer: (offer: string) => void;
  setRawResume: (resume: string) => void;
  setRawSkills: (skills: string) => void;
  setCurrentStep: (step: BuilderStep) => void;
  setSelectedTemplate: (templateId: string) => void;
  setLocale: (locale: Locale) => void;
  setGeneratedOutput: (output: GeneratedOutput | null) => void;
  setIsGenerating: (loading: boolean) => void;
  setGenerationError: (error: string | null) => void;
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
  reset: () => void;
}

export const useCVStore = create<CVStore>()(
  persist(
    (set) => ({
      cvData: emptyCVData,
      jobOffer: '',
      rawResume: '',
      rawSkills: '',
      currentStep: 1,
      selectedTemplate: 'professional',
      locale: 'fr',
      generatedOutput: null,
      isGenerating: false,
      generationError: null,

      setCVData: (data) =>
        set((state) => ({ cvData: { ...state.cvData, ...data } })),

      setPersonalInfo: (info) =>
        set((state) => ({
          cvData: {
            ...state.cvData,
            personalInfo: { ...state.cvData.personalInfo, ...info },
          },
        })),

      setJobOffer: (jobOffer) => set({ jobOffer }),
      setRawResume: (rawResume) => set({ rawResume }),
      setRawSkills: (rawSkills) => set({ rawSkills }),
      setCurrentStep: (currentStep) => set({ currentStep }),
      setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate, generatedOutput: null }),
      setLocale: (locale) => set({ locale }),
      setGeneratedOutput: (generatedOutput) => set({ generatedOutput }),
      setIsGenerating: (isGenerating) => set({ isGenerating }),
      setGenerationError: (generationError) => set({ generationError }),

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

      reset: () =>
        set({
          cvData: emptyCVData,
          jobOffer: '',
          rawResume: '',
          rawSkills: '',
          currentStep: 1,
          selectedTemplate: 'professional',
          generatedOutput: null,
          isGenerating: false,
          generationError: null,
        }),
    }),
    {
      name: 'cv-builder-storage',
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          const validTemplates = ['professional', 'charles', 'rezume'];
          if (!validTemplates.includes(state.selectedTemplate as string)) {
            state.selectedTemplate = 'professional';
          }
          state.generatedOutput = null;
        }
        if (version < 3) {
          // Ensure cvData has all required arrays for structured forms
          const cv = (state.cvData || {}) as Record<string, unknown>;
          if (!Array.isArray(cv.experiences)) cv.experiences = [];
          if (!Array.isArray(cv.education)) cv.education = [];
          if (!Array.isArray(cv.stages)) cv.stages = [];
          if (!Array.isArray(cv.languages)) cv.languages = [];
          if (!Array.isArray(cv.certifications)) cv.certifications = [];
          if (!Array.isArray(cv.skills)) cv.skills = [];
          state.cvData = cv;
        }
        return state;
      },
    }
  )
);
