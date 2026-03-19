'use client';

import { useState, useRef } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';
import { useCVStore } from '@/stores/cv-store';
import { LATEX_API_URL } from '@/lib/api-config';

export default function AIEditBar() {
  const { generatedOutput, setGeneratedOutput, locale } = useCVStore();
  const [instruction, setInstruction] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!instruction.trim() || !generatedOutput?.latexCode || loading) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${LATEX_API_URL}/edit.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store',
        body: JSON.stringify({
          latexCode: generatedOutput.latexCode,
          instruction: instruction.trim(),
          locale,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Erreur serveur' }));
        throw new Error(data.error || `Erreur ${res.status}`);
      }

      const result = await res.json();
      if (result.success && result.data?.latexCode) {
        setGeneratedOutput({
          ...generatedOutput,
          latexCode: result.data.latexCode,
        });
        setInstruction('');
      } else {
        throw new Error('Réponse invalide');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
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
          placeholder="Demandez une modification à l'IA... (ex: Rends mon résumé plus court)"
          disabled={loading}
          maxLength={1000}
          className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-gray-400 focus:bg-white transition-colors disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={!instruction.trim() || loading}
          className="shrink-0 p-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
