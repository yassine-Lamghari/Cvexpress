import { useState } from 'react';
import { LATEX_API_URL } from '@/lib/api-config';
import { useCVStore } from '@/stores/cv-store';

export function useAIEdit() {
  const { generatedOutput, updateLatexCode, locale } = useCVStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editSection = async (instruction: string) => {
    if (!instruction || !generatedOutput?.latexCode) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${LATEX_API_URL}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
        cache: 'no-store',
        body: JSON.stringify({ latexCode: generatedOutput.latexCode, instruction, locale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const result = await res.json();
      const code = result.latexCode || result.data?.latexCode;
      if (result.success && code) {
        updateLatexCode(code);
        return true;
      } else {
        throw new Error('Invalid response');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Edit failed. Please try again.';
      setError(msg);
      // Optional: alert(msg) or handle toast here
      alert(msg);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { editSection, loading, error, setError };
}
