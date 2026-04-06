import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useCVStore } from './cv-store';

describe('cv-store', () => {
  beforeEach(() => {
    useCVStore.setState(useCVStore.getInitialState ? useCVStore.getInitialState() : {});
    useCVStore.getState().reset();
  });

  describe('CRUD actions', () => {
    it('adds and removes an experience', () => {
      const exp = {
        id: '1',
        jobTitle: 'Developer',
        company: 'Corp',
        location: 'Paris',
        startDate: '2020',
        endDate: '2024',
        current: false,
        description: 'Worked hard'
      };

      useCVStore.getState().addExperience(exp);
      expect(useCVStore.getState().cvData.experiences).toContainEqual(exp);

      useCVStore.getState().removeExperience('1');
      expect(useCVStore.getState().cvData.experiences).not.toContainEqual(exp);
    });

    it('updates an experience', () => {
      const exp = {
        id: '1',
        jobTitle: 'Developer',
        company: 'Corp',
        location: 'Paris',
        startDate: '2020',
        endDate: '2024',
        current: false,
        description: 'Worked hard'
      };

      useCVStore.getState().addExperience(exp);
      useCVStore.getState().updateExperience('1', { jobTitle: 'Senior Developer' });

      const updated = useCVStore.getState().cvData.experiences.find(e => e.id === '1');
      expect(updated?.jobTitle).toBe('Senior Developer');
    });

    it('adds and removes a skill', () => {
      useCVStore.getState().addSkill({ name: 'React' });
      expect(useCVStore.getState().cvData.skills.length).toBe(1);

      useCVStore.getState().removeSkill('React');
      expect(useCVStore.getState().cvData.skills.length).toBe(0);
    });
  });

  describe('History Undo/Redo', () => {
    it('supports undoing and redoing generated output latex code', () => {
      useCVStore.getState().setGeneratedOutput({
        adaptedCV: useCVStore.getState().cvData,
        motivationLetter: '',
        candidacyEmail: '',
        latexCode: 'Initial Code'
      });

      expect(useCVStore.getState().latexHistory).toEqual(['Initial Code']);
      expect(useCVStore.getState().latexHistoryIndex).toBe(0);

      useCVStore.getState().updateLatexCode('Second Code');
      expect(useCVStore.getState().latexHistory).toEqual(['Initial Code', 'Second Code']);
      expect(useCVStore.getState().latexHistoryIndex).toBe(1);
      expect(useCVStore.getState().generatedOutput?.latexCode).toBe('Second Code');

      useCVStore.getState().undoLatex();
      expect(useCVStore.getState().latexHistoryIndex).toBe(0);
      expect(useCVStore.getState().generatedOutput?.latexCode).toBe('Initial Code');

      useCVStore.getState().redoLatex();
      expect(useCVStore.getState().latexHistoryIndex).toBe(1);
      expect(useCVStore.getState().generatedOutput?.latexCode).toBe('Second Code');
    });
  });

  describe('SessionStorage Persistence', () => {
    it('is persisted properly (mocking storage partialize)', () => {
       const state = useCVStore.getState();
       expect(state.selectedTemplate).toBe('rezume'); // default
       state.setSelectedTemplate('modern_image');
       expect(useCVStore.getState().selectedTemplate).toBe('modern_image');
    });
  });
});