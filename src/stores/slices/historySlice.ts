import { StateCreator } from 'zustand';
import { CVStore } from '../cv-store';

export interface HistorySlice {
  latexHistory: string[];
  latexHistoryIndex: number;

  updateLatexCode: (code: string) => void;
  undoLatex: () => void;
  redoLatex: () => void;
}

export const createHistorySlice: StateCreator<CVStore, [], [], HistorySlice> = (set) => ({
  latexHistory: [],
  latexHistoryIndex: -1,

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
});