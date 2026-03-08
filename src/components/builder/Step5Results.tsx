'use client';

import { useState } from 'react';
import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import { Download, Copy, Check, RefreshCw, ArrowLeft, FileText, Mail, Sparkles, Pencil } from 'lucide-react';
import dynamic from 'next/dynamic';
import { LatexCodePreview } from '@/components/preview/registry';
import AIEditBar from '@/components/editor/AIEditBar';

const PDFDownloadButton = dynamic(() => import('@/components/pdf/PDFDownloadButton'), { ssr: false });

export default function Step5Results() {
  const { t } = useTranslations();
  const { generatedOutput, setGeneratedOutput, setCurrentStep, selectedTemplate } = useCVStore();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeTab, setActiveTab] = useState<'cv' | 'letter' | 'email'>('cv');

  if (!generatedOutput) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm">
          {t('builder.generating')}
        </p>
      </div>
    );
  }

  const updateLetter = (value: string) => {
    setGeneratedOutput({ ...generatedOutput, motivationLetter: value });
  };

  const updateEmail = (value: string) => {
    setGeneratedOutput({ ...generatedOutput, candidacyEmail: value });
  };

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(generatedOutput.candidacyEmail);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const tabs = [
    { id: 'cv' as const, label: t('results.cvTitle'), icon: FileText },
    { id: 'letter' as const, label: t('results.letterTitle'), icon: Mail },
    { id: 'email' as const, label: t('results.emailTitle'), icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* CV Tab — PDF Preview + AI Edit */}
      {activeTab === 'cv' && (
        <div className="space-y-4">
          {/* Edit hint */}
          <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded-md px-3 py-2">
            <Pencil className="w-3.5 h-3.5" />
            {t('results.editHint')}
          </div>

          {/* PDF Preview */}
          <div className="max-w-3xl mx-auto">
            {generatedOutput.latexCode ? (
              <div className="bg-white shadow-lg border border-gray-200 overflow-hidden">
                <div style={{ aspectRatio: '210 / 297' }}>
                  <LatexCodePreview latexCode={generatedOutput.latexCode} template={selectedTemplate} />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center text-gray-500 text-sm">
                Aperçu non disponible pour ce template.
              </div>
            )}
          </div>

          {/* AI Edit Bar */}
          <AIEditBar />

          {/* Download */}
          <PDFDownloadButton />
        </div>
      )}

      {/* Letter Tab */}
      {activeTab === 'letter' && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-md p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('results.letterTitle')}</h4>
            <textarea
              value={generatedOutput.motivationLetter}
              onChange={(e) => updateLetter(e.target.value)}
              rows={14}
              className="w-full text-sm text-gray-700 leading-relaxed border border-gray-200 rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
            />
          </div>
          <button
            onClick={() => {
              const blob = new Blob([generatedOutput.motivationLetter], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'lettre-motivation.txt';
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            <Download className="w-4 h-4" />
            {t('results.downloadLetter')}
          </button>
        </div>
      )}

      {/* Email Tab */}
      {activeTab === 'email' && (
        <div className="space-y-4">
          <div className="border border-gray-200 rounded-md p-5">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">{t('results.emailTitle')}</h4>
            <textarea
              value={generatedOutput.candidacyEmail}
              onChange={(e) => updateEmail(e.target.value)}
              rows={10}
              className="w-full text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 border border-gray-200 rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
            />
          </div>
          <button
            onClick={handleCopyEmail}
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            {copiedEmail ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copiedEmail ? t('results.copied') : t('results.copyEmail')}
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 pt-4 border-t border-gray-200">
        <button
          onClick={() => setCurrentStep(1)}
          className="flex items-center gap-1.5 px-4 py-2 text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          {t('results.backToEdit')}
        </button>
        <button
          onClick={() => setCurrentStep(4)}
          className="flex items-center gap-1.5 px-4 py-2 text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors text-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {t('results.changeTemplate')}
        </button>
      </div>
    </div>
  );
}
