'use client';

import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import StepIndicator from '@/components/builder/StepIndicator';
import Step1Profile from '@/components/builder/Step1Profile';
import Step2Skills from '@/components/builder/Step2Skills';
import Step3JobOffer from '@/components/builder/Step3JobOffer';
import Step4Template from '@/components/builder/Step4Template';
import Step5Results from '@/components/builder/Step5Results';
import AdBanner from '@/components/ads/AdBanner';
import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import type { BuilderStep } from '@/types/cv';

export default function BuilderPage() {
  const { t } = useTranslations();
  const {
    currentStep,
    setCurrentStep,
    rawResume,
    rawSkills,
    jobOffer,
    cvData,
    selectedTemplate,
    locale,
    isGenerating,
    setIsGenerating,
    setGeneratedOutput,
    setGenerationError,
    generationError,
  } = useCVStore();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const response = await fetch('/api/generate/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume: rawResume,
          skills: rawSkills + '\n' + cvData.skills.map((s) => s.name).join(', '),
          jobOffer,
          locale,
          template: selectedTemplate,
          candidateName: `${cvData.personalInfo.firstName} ${cvData.personalInfo.lastName}`.trim(),
          personalTitle: cvData.personalInfo.title || '',
          personalInfo: cvData.personalInfo,
          experiences: cvData.experiences,
          stages: cvData.stages,
          education: cvData.education,
          languages: cvData.languages,
          certifications: cvData.certifications,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const result = await response.json();
      const aiData = result.data;
      console.log('[builder] aiData keys:', Object.keys(aiData || {}));
      console.log('[builder] aiData.latexCode length:', aiData?.latexCode?.length ?? 'undefined');
      console.log('[builder] aiData.latexCode first 200:', aiData?.latexCode?.substring?.(0, 200));

      setGeneratedOutput({
        adaptedCV: {
          personalInfo: cvData.personalInfo,
          summary: '',
          experiences: cvData.experiences,
          stages: cvData.stages,
          education: cvData.education,
          skills: cvData.skills,
          languages: cvData.languages,
          certifications: cvData.certifications,
        },
        motivationLetter: aiData.motivationLetter || '',
        candidacyEmail: aiData.candidacyEmail || '',
        latexCode: aiData.latexCode || '',
      });

      setCurrentStep(5);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return cvData.personalInfo.firstName && cvData.personalInfo.lastName && rawResume.length > 20;
      case 2:
        return rawSkills.length > 5 || cvData.skills.length > 0;
      case 3:
        return jobOffer.length > 30;
      case 4:
        return !!selectedTemplate;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < 5) {
      setCurrentStep((currentStep + 1) as BuilderStep);
    }
  };

  const goPrev = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as BuilderStep);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <Step1Profile />;
      case 2:
        return <Step2Skills />;
      case 3:
        return <Step3JobOffer />;
      case 4:
        return <Step4Template />;
      case 5:
        return <Step5Results />;
      default:
        return null;
    }
  };

  return (
    <>
      <Navbar />
      <main className="flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

          {/* Breadcrumb */}
          <nav className="text-xs text-gray-400 mb-6">
            <span className="hover:text-gray-600 cursor-pointer">Accueil</span>
            <span className="mx-2">/</span>
            <span className="text-gray-700 font-medium">{t('builder.title')}</span>
          </nav>

          <div className="flex flex-col lg:flex-row gap-8">

            {/* Main content — left */}
            <aside className="flex-1 min-w-0 space-y-5">
              {/* Article header */}
              <article className="bg-white border border-gray-200 rounded mb-6">
                <div className="p-6 border-b border-gray-100">
                  <h1 className="text-2xl font-bold text-gray-900 mb-1">{t('builder.title')}</h1>
                  <p className="text-sm text-gray-500">
                    {t(`builder.step${currentStep}Desc`)}
                  </p>
                </div>

                {/* Step Indicator */}
                <div className="px-6 pt-4">
                  <StepIndicator />
                </div>

                {/* Step Content */}
                <div className="p-6">
                  {renderStep()}
                </div>
              </article>

              {/* Error Message */}
              {generationError && (
                <div className="bg-red-50 border border-red-200 rounded p-4 mb-6 text-red-700 text-sm">
                  {generationError}
                </div>
              )}

              {/* Navigation Buttons */}
              {currentStep < 5 && (
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={goPrev}
                    disabled={currentStep === 1}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {t('builder.previous')}
                  </button>

                  {currentStep === 4 ? (
                    <button
                      onClick={handleGenerate}
                      disabled={!canGoNext() || isGenerating}
                      className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="w-4 h-4 spinner" />
                          {t('builder.generating')}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          {t('builder.generate')}
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={goNext}
                      disabled={!canGoNext()}
                      className="flex items-center gap-2 px-5 py-2 bg-gray-900 text-white rounded text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {t('builder.next')}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}

              {/* Ad below content */}
              {currentStep <= 3 && (
                <div className="mb-6">
                  <AdBanner
                    adKey={process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY || ''}
                    format="banner"
                    width={728}
                    height={90}
                  />
                </div>
              )}
            </aside>

            {/* Sidebar — right */}
            <div className="lg:w-64 shrink-0 space-y-5">

              {/* Steps widget */}
              <div className="bg-white border border-gray-200 rounded p-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-200">Étapes</h3>
                <ul className="space-y-1">
                  {[
                    { num: 1, label: t('builder.step1Title') },
                    { num: 2, label: t('builder.step2Title') },
                    { num: 3, label: t('builder.step3Title') },
                    { num: 4, label: t('builder.step4Title') },
                    { num: 5, label: t('builder.step5Title') },
                  ].map((step) => (
                    <li key={step.num}>
                      <button
                        onClick={() => step.num <= currentStep ? setCurrentStep(step.num as BuilderStep) : null}
                        className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-xs transition-colors ${
                          step.num === currentStep
                            ? 'bg-gray-900 text-white font-medium'
                            : step.num < currentStep
                            ? 'text-gray-600 hover:bg-gray-50 cursor-pointer'
                            : 'text-gray-300 cursor-default'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          step.num === currentStep
                            ? 'bg-white text-gray-900'
                            : step.num < currentStep
                            ? 'bg-gray-200 text-gray-600'
                            : 'bg-gray-100 text-gray-300'
                        }`}>
                          {step.num < currentStep ? '✓' : step.num}
                        </span>
                        {step.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Tips widget */}
              <div className="bg-white border border-gray-200 rounded p-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-200">Conseils</h3>
                <ul className="text-xs text-gray-500 space-y-2 leading-relaxed">
                  <li>→ Plus vous détaillez votre parcours, meilleur sera le CV généré.</li>
                  <li>→ Collez l&apos;offre d&apos;emploi complète pour un résultat optimal.</li>
                  <li>→ Vous pouvez revenir sur une étape à tout moment.</li>
                </ul>
              </div>

              {/* Ad widget */}
              <AdBanner
                adKey={process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY || ''}
                format="banner"
                width={300}
                height={250}
              />

            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
