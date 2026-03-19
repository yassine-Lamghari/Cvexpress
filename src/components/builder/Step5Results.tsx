'use client';

import { useState, useRef, useEffect } from 'react';
import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import { LATEX_API_URL } from '@/lib/api-config';
import { Download, Copy, Check, RefreshCw, ArrowLeft, FileText, Mail, Sparkles, Pencil, Code, Eye, ChevronDown, ChevronUp, Columns2, Maximize2, MousePointerClick, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import { LatexCodePreview } from '@/components/preview/registry';
import ClickablePreview from '@/components/editor/ClickablePreview';
import SectionEditPopover from '@/components/editor/SectionEditPopover';
import AIEditBar from '@/components/editor/AIEditBar';
import type { ParsedSection } from '@/lib/latex-parser';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSaveCV } from '@/lib/use-save-cv';

const PDFDownloadButton = dynamic(() => import('@/components/pdf/PDFDownloadButton'), { ssr: false });

export default function Step5Results() {
  const { t } = useTranslations();
  const { generatedOutput, setGeneratedOutput, setCurrentStep, selectedTemplate, locale, cvData } = useCVStore();
  const { user } = useAuth();
  const { saveCV, saving, saveStatus } = useSaveCV();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [activeTab, setActiveTab] = useState<'cv' | 'letter' | 'email'>('cv');
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [localLatex, setLocalLatex] = useState('');
  const [hasUnapplied, setHasUnapplied] = useState(false);
  const [splitView, setSplitView] = useState(false);
  const [editingSection, setEditingSection] = useState<ParsedSection | null>(null);
  const [editAnchorRect, setEditAnchorRect] = useState<DOMRect | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  // Sync local editor with store
  useEffect(() => {
    if (generatedOutput?.latexCode) {
      setLocalLatex(generatedOutput.latexCode);
      setHasUnapplied(false);
    }
  }, [generatedOutput?.latexCode]);

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

  const handleLocalLatexChange = (value: string) => {
    setLocalLatex(value);
    setHasUnapplied(value !== generatedOutput.latexCode);

    // In split view, auto-apply after 2s of no typing
    if (splitView) {
      if (editorTimerRef.current) clearTimeout(editorTimerRef.current);
      editorTimerRef.current = setTimeout(() => {
        setGeneratedOutput({ ...generatedOutput, latexCode: value });
        setHasUnapplied(false);
      }, 2000);
    }
  };

  const applyCodeChanges = () => {
    if (editorTimerRef.current) clearTimeout(editorTimerRef.current);
    setGeneratedOutput({ ...generatedOutput, latexCode: localLatex });
    setHasUnapplied(false);
  };

  const discardCodeChanges = () => {
    if (editorTimerRef.current) clearTimeout(editorTimerRef.current);
    setLocalLatex(generatedOutput.latexCode || '');
    setHasUnapplied(false);
  };

  const handleSectionClick = (section: ParsedSection, rect: DOMRect) => {
    setEditingSection(section);
    setEditAnchorRect(rect);
  };

  const handleSectionSave = async (instruction: string) => {
    if (!instruction || !generatedOutput.latexCode) return;
    setEditLoading(true);
    try {
      const res = await fetch(`${LATEX_API_URL}/edit.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store',
        body: JSON.stringify({ latexCode: generatedOutput.latexCode, instruction, locale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(data.error || `Error ${res.status}`);
      }
      const result = await res.json();
      if (result.success && result.data?.latexCode) {
        setGeneratedOutput({ ...generatedOutput, latexCode: result.data.latexCode });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Edit failed. Please try again.');
    } finally {
      setEditLoading(false);
      setEditingSection(null);
      setEditAnchorRect(null);
    }
  };

  // Quick AI suggestion chips
  const suggestions = locale === 'fr'
    ? [
        'Rends le résumé plus concis',
        'Ajoute plus de mots-clés techniques',
        'Mets en avant les résultats chiffrés',
        "Reformule les expériences avec des verbes d'action",
        'Ajoute une section Projets',
        'Réorganise les compétences par catégorie',
      ]
    : [
        'Make the summary more concise',
        'Add more technical keywords',
        'Highlight quantified results',
        'Rephrase experiences with action verbs',
        'Add a Projects section',
        'Reorganize skills by category',
      ];

  const tabs = [
    { id: 'cv' as const, label: t('results.cvTitle'), icon: FileText },
    { id: 'letter' as const, label: t('results.letterTitle'), icon: Mail },
    { id: 'email' as const, label: t('results.emailTitle'), icon: Sparkles },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 items-center">
        <div className="flex gap-1 flex-1">
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
        {user && (
          <button
            onClick={() => saveCV(undefined, generatedOutput)}
            disabled={saving}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${
              saveStatus === 'saved'
                ? 'bg-green-50 text-green-700 border-green-200'
                : saveStatus === 'error'
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
            }`}
          >
            {saveStatus === 'saved' ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? t('auth.saving') : saveStatus === 'saved' ? t('auth.saved') : t('auth.saveCv')}
          </button>
        )}
      </div>

      {/* CV Tab — PDF Preview + Editing */}
      {activeTab === 'cv' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <MousePointerClick className="w-3.5 h-3.5" />
              {locale === 'fr' ? 'Cliquez sur une section du PDF pour la modifier' : 'Click a section on the PDF to edit it'}
            </div>
            <button
              onClick={() => { setAdvancedMode(!advancedMode); if (advancedMode) { setSplitView(false); setShowCodeEditor(false); } }}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${advancedMode ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
            >
              <Code className="w-3.5 h-3.5" />
              {locale === 'fr' ? 'Mode avancé' : 'Advanced mode'}
            </button>
          </div>

          {/* === CLICKABLE PREVIEW (default mode) === */}
          {!advancedMode && (
            <div ref={previewContainerRef} className="relative max-w-3xl mx-auto">
              {generatedOutput.latexCode ? (
                <div className="bg-white shadow-lg border border-gray-200 overflow-hidden">
                  <ClickablePreview
                    latexCode={generatedOutput.latexCode}
                    template={selectedTemplate || 'professional'}                    photo={cvData.personalInfo?.photo || ''}                    locale={locale}
                    onSectionClick={handleSectionClick}
                    activeSection={editingSection?.id}
                  />
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center text-gray-500 text-sm">
                  {locale === 'fr' ? 'Aperçu non disponible pour ce template.' : 'Preview not available for this template.'}
                </div>
              )}

              {/* Section Edit Popover */}
              {editingSection && editAnchorRect && (
                <SectionEditPopover
                  section={editingSection}
                  anchorRect={editAnchorRect}
                  containerRef={previewContainerRef}
                  onSave={handleSectionSave}
                  onClose={() => { setEditingSection(null); setEditAnchorRect(null); }}
                  loading={editLoading}
                  locale={locale}
                />
              )}
            </div>
          )}

          {/* === ADVANCED MODE: Split view or preview === */}
          {advancedMode && (
            <>
              {/* Split view toggle */}
              <div className="flex justify-end">
                <button
                  onClick={() => { setSplitView(!splitView); if (!splitView) setShowCodeEditor(false); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border transition-colors ${splitView ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                >
                  <Columns2 className="w-3.5 h-3.5" />
                  {locale === 'fr' ? 'Éditeur côte à côte' : 'Side-by-side editor'}
                </button>
              </div>

              {splitView ? (
                <div className="flex flex-col lg:flex-row gap-4" style={{ minHeight: '70vh' }}>
                  {/* Left: Code Editor */}
                  <div className="flex-1 min-w-0 flex flex-col border border-gray-200 rounded-md overflow-hidden">
                    <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200 shrink-0">
                      <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                        <Code className="w-3.5 h-3.5" />
                        {locale === 'fr' ? 'Code LaTeX' : 'LaTeX Code'}
                      </span>
                      <div className="flex items-center gap-2">
                        {hasUnapplied && (
                          <>
                            <button onClick={discardCodeChanges} className="text-xs text-gray-500 hover:text-gray-700 transition-colors">
                              {locale === 'fr' ? 'Annuler' : 'Discard'}
                            </button>
                            <button onClick={applyCodeChanges} className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors">
                              <Eye className="w-3 h-3" />
                              {locale === 'fr' ? 'Appliquer' : 'Apply'}
                            </button>
                          </>
                        )}
                        <button onClick={() => setSplitView(false)} className="p-1 text-gray-400 hover:text-gray-600 transition-colors" title={locale === 'fr' ? 'Fermer' : 'Close'}>
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <textarea
                      ref={textareaRef}
                      value={localLatex}
                      onChange={(e) => handleLocalLatexChange(e.target.value)}
                      spellCheck={false}
                      className="flex-1 w-full font-mono text-xs leading-relaxed p-3 bg-white text-gray-800 outline-none resize-none"
                    />
                    {hasUnapplied && (
                      <div className="bg-amber-50 border-t border-amber-200 px-3 py-1.5 text-xs text-amber-700">
                        {locale === 'fr' ? 'Aperçu mis à jour après 2s' : 'Preview auto-updates after 2s'}
                      </div>
                    )}
                  </div>
                  {/* Right: Live Preview */}
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="bg-white shadow-lg border border-gray-200 overflow-hidden flex-1">
                      <div style={{ aspectRatio: '210 / 297' }}>
                          <LatexCodePreview 
                            latexCode={generatedOutput.latexCode || ''} 
                            template={selectedTemplate || 'professional'} 
                            photo={cvData.personalInfo?.photo || ''}
                          />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-3xl mx-auto">
                  {generatedOutput.latexCode ? (
                    <div className="bg-white shadow-lg border border-gray-200 overflow-hidden">
                      <div style={{ aspectRatio: '210 / 297' }}>
                          <LatexCodePreview 
                            latexCode={generatedOutput.latexCode} 
                            template={selectedTemplate || 'professional'} 
                            photo={cvData.personalInfo?.photo || ''}
                          />
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center text-gray-500 text-sm">
                      {locale === 'fr' ? 'Aperçu non disponible.' : 'Preview not available.'}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* === EDITING TOOLS (below both views) === */}
          <div className="space-y-3 border-t border-gray-200 pt-4">

            {/* AI Edit Bar */}
            <AIEditBar />

            {/* Quick AI suggestion chips */}
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <SuggestionChip key={suggestion} label={suggestion} />
              ))}
            </div>

            {/* Toggle buttons row (only in advanced mode, non-split) */}
            {advancedMode && !splitView && (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCodeEditor(!showCodeEditor)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-md border transition-colors ${
                    showCodeEditor
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  {locale === 'fr' ? 'Éditeur LaTeX' : 'LaTeX Editor'}
                  {showCodeEditor ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            )}

            {/* LaTeX Code Editor (collapsible, advanced non-split only) */}
            {showCodeEditor && advancedMode && !splitView && (
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                    <Code className="w-3.5 h-3.5" />
                    {locale === 'fr' ? 'Code LaTeX' : 'LaTeX Code'}
                  </span>
                  {hasUnapplied && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={discardCodeChanges}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                      >
                        {locale === 'fr' ? 'Annuler' : 'Discard'}
                      </button>
                      <button
                        onClick={applyCodeChanges}
                        className="flex items-center gap-1 px-2.5 py-1 bg-gray-900 text-white text-xs rounded hover:bg-gray-800 transition-colors"
                      >
                        <Eye className="w-3 h-3" />
                        {locale === 'fr' ? 'Appliquer' : 'Apply'}
                      </button>
                    </div>
                  )}
                </div>
                <textarea
                  ref={textareaRef}
                  value={localLatex}
                  onChange={(e) => handleLocalLatexChange(e.target.value)}
                  rows={20}
                  spellCheck={false}
                  className="w-full font-mono text-xs leading-relaxed p-3 bg-white text-gray-800 outline-none resize-y"
                />
              </div>
            )}
          </div>

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

/** Suggestion chip that auto-submits an AI edit request */
function SuggestionChip({ label }: { label: string }) {
  const { generatedOutput, setGeneratedOutput, locale } = useCVStore();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!generatedOutput?.latexCode || loading) return;

    setLoading(true);
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
          instruction: label,
          locale,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Server error' }));
        throw new Error(data.error || `Error ${res.status}`);
      }

      const result = await res.json();
      if (result.success && result.data?.latexCode) {
        setGeneratedOutput({ ...generatedOutput, latexCode: result.data.latexCode });
      }
    } catch {
      // Suggestion chips are secondary — AIEditBar handles main error display
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="px-3 py-1.5 text-xs rounded-full border border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors disabled:opacity-50"
    >
      {loading ? '...' : label}
    </button>
  );
}
