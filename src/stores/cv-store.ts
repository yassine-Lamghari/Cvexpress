import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { ProfileSlice, createProfileSlice } from './slices/profileSlice';
import { BuilderSlice, createBuilderSlice } from './slices/builderSlice';
import { HistorySlice, createHistorySlice } from './slices/historySlice';

export type CVStore = ProfileSlice & BuilderSlice & HistorySlice;

export const useCVStore = create<CVStore>()(
  persist(
    (...a) => ({
      ...createProfileSlice(...a),
      ...createBuilderSlice(...a),
      ...createHistorySlice(...a),
    }),
    {
      name: 'cv-builder-storage',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : ({} as any))),
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
