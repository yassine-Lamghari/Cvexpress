'use client';

import { useState } from 'react';
import { useCVStore } from '@/stores/cv-store';
import { Download, Loader2 } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useAuth } from '@/components/auth/AuthProvider';
import AuthModal from '@/components/auth/AuthModal';
import { supabase } from '@/lib/supabase';
import { generateAndDownloadPdf } from '@/lib/client-pdf-jobs';

export default function PDFDownloadButton() {
  const { t } = useTranslations();
  const { generatedOutput, selectedTemplate, cvData } = useCVStore();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
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
    setProgress(0);

    try {
      await generateAndDownloadPdf({
        token,
        latexCode: generatedOutput.latexCode,
        template: selectedTemplate,
        filename,
        photo: cvData.personalInfo?.photo || '',
        onProgress: setProgress,
      });
    } catch (err) {
      console.error('LaTeX download failed:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
      setProgress(0);
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
        {downloading ? `Génération ${progress}%` : t('results.downloadCV')}
      </button>

      <AuthModal 
        open={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </>
  );
}





