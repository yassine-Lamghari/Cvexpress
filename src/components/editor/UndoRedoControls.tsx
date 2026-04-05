'use client';

import { useCVStore } from '@/stores/cv-store';
import { Undo, Redo } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

export default function UndoRedoControls() {
  const { t } = useTranslations();
  const { latexHistory, latexHistoryIndex, undoLatex, redoLatex } = useCVStore();

  const canUndo = latexHistoryIndex > 0;
  const canRedo = latexHistoryIndex < latexHistory.length - 1;

  if (latexHistory.length <= 1) return null;

  return (
    <div className="flex items-center gap-1.5 mb-3 bg-white p-1 rounded-md border border-gray-200 inline-flex w-fit shadow-sm">
      <button
        onClick={undoLatex}
        disabled={!canUndo}
        title={t('common.undo')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          canUndo 
            ? 'text-gray-700 hover:bg-gray-100' 
            : 'text-gray-300 cursor-not-allowed'
        }`}
      >
        <Undo className="w-3.5 h-3.5" />
        {t('common.undo') || 'Annuler'}
      </button>
      
      <div className="w-px h-4 bg-gray-200" />
      
      <button
        onClick={redoLatex}
        disabled={!canRedo}
        title={t('common.redo')}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          canRedo 
            ? 'text-gray-700 hover:bg-gray-100' 
            : 'text-gray-300 cursor-not-allowed'
        }`}
      >
        <Redo className="w-3.5 h-3.5" />
        {t('common.redo') || 'Rétablir'}
      </button>
    </div>
  );
}
