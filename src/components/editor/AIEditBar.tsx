'use client';

import { useState, useRef } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import { useAIEdit } from '@/lib/use-ai-edit';

export default function AIEditBar() {
  const { t } = useTranslations();
  const { editSection, loading, error } = useAIEdit();
  const [instruction, setInstruction] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!instruction.trim() || loading) return;
    const success = await editSection(instruction.trim());
    if (success) {
      setInstruction('');
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-gray-200 bg-white pt-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('history.aiEditPlaceholder')}
          disabled={loading}
          maxLength={1000}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!instruction.trim() || loading}
          className="shrink-0 p-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 hover:shadow-md transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 mt-1.5 ml-6">
          <p className="text-xs text-red-500">{error}</p>
          <button
            onClick={handleSubmit}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            {t('common.retry')}
          </button>
        </div>
      )}
    </div>
  );
}



