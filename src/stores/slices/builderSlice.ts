import { StateCreator } from 'zustand';
import { BuilderStep, Locale, GeneratedOutput } from '@/types/cv';
import { CVStore } from '../cv-store';
import { emptyCVData } from './profileSlice';

export interface BuilderSlice {
  jobOffer: string;
  rawResume: string;
  rawSkills: string;
  currentStep: BuilderStep;
  selectedTemplate: string;
  locale: Locale;
  generatedOutput: GeneratedOutput | null;
  isGenerating: boolean;
  generationError: string | null;

  setJobOffer: (offer: string) => void;
  setRawResume: (resume: string) => void;
  setRawSkills: (skills: string) => void;
  setCurrentStep: (step: BuilderStep) => void;
  setSelectedTemplate: (templateId: string) => void;
  setLocale: (locale: Locale) => void;
  setGeneratedOutput: (output: GeneratedOutput | null) => void;
  setIsGenerating: (loading: boolean) => void;
  setGenerationError: (error: string | null) => void;
  reset: () => void;
}

export const createBuilderSlice: StateCreator<CVStore, [], [], BuilderSlice> = (set) => ({
  jobOffer: '',
  rawResume: '',
  rawSkills: '',
  currentStep: 1,
  selectedTemplate: 'rezume',
  locale: 'fr',
  generatedOutput: null,
  isGenerating: false,
  generationError: null,

  setJobOffer: (jobOffer) => set({ jobOffer }),
  setRawResume: (rawResume) => set({ rawResume }),
  setRawSkills: (rawSkills) => set({ rawSkills }),
  setCurrentStep: (currentStep) => set({ currentStep }),
  setSelectedTemplate: (selectedTemplate) => 
    set({ selectedTemplate, generatedOutput: null, latexHistory: [], latexHistoryIndex: -1 }),
  setLocale: (locale) => set({ locale }),
  setGeneratedOutput: (generatedOutput) => set({ 
    generatedOutput,
    ...(generatedOutput?.latexCode 
      ? { latexHistory: [generatedOutput.latexCode], latexHistoryIndex: 0 }
      : { latexHistory: [], latexHistoryIndex: -1 })
  }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setGenerationError: (generationError) => set({ generationError }),
  
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
});