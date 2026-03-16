'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface LatexCodePreviewProps {
  latexCode: string;
  template: string;
  photo?: string;
}

const LATEX_API_URL = process.env.NEXT_PUBLIC_LATEX_API_URL || 'http://localhost:8000';
const DEBOUNCE_MS = 1500;

export default function LatexCodePreview({ latexCode, template, photo }: LatexCodePreviewProps) {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<'png' | 'pdf'>('png');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchPreview = useCallback(async (code: string) => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${LATEX_API_URL}/latex-preview.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latexCode: code, template, photo }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const result = await res.json();
      if (result.success && result.preview) {
        setPreviewSrc(result.preview);
        setFormat(result.format === 'pdf' ? 'pdf' : 'png');
      } else {
        throw new Error(result.error || 'Invalid response');
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
    } finally {
      setLoading(false);
    }
  }, [template]);

  useEffect(() => {
    if (!latexCode) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchPreview(latexCode);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [latexCode, fetchPreview]);

  useEffect(() => {
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  return (
    <div className="relative w-full" style={{ aspectRatio: '210 / 297' }}>
      {previewSrc && !loading && !error && (
        format === 'png' ? (
          <img
            src={previewSrc}
            alt="CV Preview"
            className="w-full h-full object-contain"
          />
        ) : (
          <embed
            src={previewSrc}
            type="application/pdf"
            className="w-full h-full"
          />
        )
      )}

      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            <span className="text-xs text-gray-500">Compilation LaTeX...</span>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-50/80">
          <div className="flex flex-col items-center gap-2 max-w-xs text-center px-4">
            <AlertCircle className="w-8 h-8 text-red-400" />
            <span className="text-xs text-red-600">{error}</span>
            <button
              onClick={() => fetchPreview(latexCode)}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-gray-900 mt-1"
            >
              <RefreshCw className="w-3 h-3" />
              Réessayer
            </button>
          </div>
        </div>
      )}

      {!previewSrc && !loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
          <span className="text-xs text-gray-400">Aperçu en cours de chargement...</span>
        </div>
      )}
    </div>
  );
}
