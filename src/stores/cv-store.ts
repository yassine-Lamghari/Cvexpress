import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

  // History (Undo/Redo for LaTeX)
  latexHistory: string[];
  latexHistoryIndex: number;

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
  
  // Custom setter for latex update with history recording
  updateLatexCode: (code: string) => void;
  undoLatex: () => void;
  redoLatex: () => void;
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
      selectedTemplate: 'rezume',
      locale: 'fr',
      generatedOutput: null,
      latexHistory: [],
      latexHistoryIndex: -1,
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
      setSelectedTemplate: (selectedTemplate) => set({ selectedTemplate, generatedOutput: null, latexHistory: [], latexHistoryIndex: -1 }),
      setLocale: (locale) => set({ locale }),
      setGeneratedOutput: (generatedOutput) => set({ 
        generatedOutput,
        ...(generatedOutput?.latexCode 
          ? { latexHistory: [generatedOutput.latexCode], latexHistoryIndex: 0 }
          : { latexHistory: [], latexHistoryIndex: -1 })
      }),
      
      updateLatexCode: (code) =>
        set((state) => {
          if (!state.generatedOutput || state.generatedOutput.latexCode === code) return state;
          
          const newHistory = state.latexHistory.slice(0, state.latexHistoryIndex + 1);
          newHistory.push(code);
          
          // Keep maximum 50 states to save memory
          if (newHistory.length > 50) {
            newHistory.shift();
          }
          
          return {
            generatedOutput: { ...state.generatedOutput, latexCode: code },
            latexHistory: newHistory,
            latexHistoryIndex: newHistory.length - 1
          };
        }),

      undoLatex: () =>
        set((state) => {
          if (state.latexHistoryIndex > 0 && state.generatedOutput) {
            const index = state.latexHistoryIndex - 1;
            return {
              latexHistoryIndex: index,
              generatedOutput: { ...state.generatedOutput, latexCode: state.latexHistory[index] }
            };
          }
          return state;
        }),

      redoLatex: () =>
        set((state) => {
          if (state.latexHistoryIndex < state.latexHistory.length - 1 && state.generatedOutput) {
            const index = state.latexHistoryIndex + 1;
            return {
              latexHistoryIndex: index,
              generatedOutput: { ...state.generatedOutput, latexCode: state.latexHistory[index] }
            };
          }
          return state;
        }),
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
          selectedTemplate: 'rezume',
          generatedOutput: null,
          latexHistory: [],
          latexHistoryIndex: -1,
          isGenerating: false,
          generationError: null,
        }),
    }),
    {
      name: 'cv-builder-storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? sessionStorage : ({} as any))),
      version: 3,
      partialize: (state) => {
        // Exclude photo from persistence to avoid localStorage quota issues
        // (photos are large base64 strings that quickly exceed 5MB limits)
        const { cvData, rawResume, rawSkills, ...rest } = state;
        const safeCVData = {
          ...cvData,
          personalInfo: { ...cvData.personalInfo, photo: '' },
        };
        // 5 MB localStorage soft limit; truncate raw text if exceeded
        const serialized = JSON.stringify({ cvData: safeCVData, rawResume, rawSkills, ...rest });
        if (serialized.length > 5 * 1024 * 1024) {
          return {
            cvData: safeCVData,
            rawResume: (rawResume || '').slice(0, 10_000),
            rawSkills: (rawSkills || '').slice(0, 10_000),
            ...rest,
          };
        }
        return { cvData: safeCVData, rawResume, rawSkills, ...rest };
      },
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version < 2) {
          const validTemplates = ['rezume', 'modern_image'];
          if (!validTemplates.includes(state.selectedTemplate as string)) {
            state.selectedTemplate = 'rezume';
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
