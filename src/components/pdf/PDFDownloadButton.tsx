'use client';

import { useState } from 'react';
import { useCVStore } from '@/stores/cv-store';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { LATEX_API_URL } from '@/lib/api-config';
import { useAuth } from '@/components/auth/AuthProvider';
import AuthModal from '@/components/auth/AuthModal';
import { supabase } from '@/lib/supabase';

export default function PDFDownloadButton() {
  const { t } = useTranslations();
  const { generatedOutput, selectedTemplate, cvData } = useCVStore();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleDownload = async () => {
    if (!generatedOutput?.latexCode) return;

    if (!user) {
      setShowAuthModal(true);
      return;
    }

    // Get fresh session token for authentication
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) {
      setShowAuthModal(true);
      return;
    }

    const filename = `CV-${cvData.personalInfo.firstName}-${cvData.personalInfo.lastName}.pdf`;
    setDownloading(true);

    try {
      const res = await fetch(`${LATEX_API_URL}/latex/download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          latexCode: generatedOutput.latexCode,
          template: selectedTemplate,
          filename,
          photo: cvData.personalInfo?.photo || ''
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('LaTeX download failed:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <button
        onClick={handleDownload}
        disabled={!generatedOutput || downloading}
        className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 hover:shadow-md transition-all active:scale-95 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {downloading ? 'Compilation...' : t('results.downloadCV')}
      </button>

      <AuthModal 
        open={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </>
  );
}





