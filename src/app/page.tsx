'use client';

import { ArrowRight, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AdBanner from '@/components/ads/AdBanner';
import StepIndicator from '@/components/builder/StepIndicator';
import Step1Profile from '@/components/builder/Step1Profile';
import Step2Skills from '@/components/builder/Step2Skills';
import Step3JobOffer from '@/components/builder/Step3JobOffer';
import Step4Template from '@/components/builder/Step4Template';
import Step5Results from '@/components/builder/Step5Results';
import { useTranslations } from '@/lib/i18n';
import { useCVStore } from '@/stores/cv-store';
import { LATEX_API_URL } from '@/lib/api-config';
import { useAuth } from '@/components/auth/AuthProvider';
import { useSaveCV } from '@/lib/use-save-cv';
import type { BuilderStep } from '@/types/cv';

export default function HomePage() {
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
  const { user } = useAuth();
  const { saveCV } = useSaveCV();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerationError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);
      const response = await fetch(`${LATEX_API_URL}/generate.php`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          resume: rawResume,
          skills: rawSkills + '\n' + (cvData.skills ?? []).map((s) => s.name).join(', '),
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

      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const detail = errorData.detail ? ` (${errorData.detail})` : '';
        throw new Error((errorData.error || 'Generation failed') + detail);
      }

      const result = await response.json();
      const aiData = result.data;

      // Build adapted CV from the full structured AI response
      const aiExperiences = Array.isArray(aiData.experiences) && aiData.experiences.length > 0
        ? aiData.experiences.map((e: Record<string, string>, i: number) => ({
            id: String(i + 1),
            jobTitle: e.jobTitle || '',
            company: e.company || '',
            location: e.location || '',
            startDate: e.startDate || '',
            endDate: e.endDate || '',
            description: e.description || '',
          }))
        : cvData.experiences;

      const aiEducation = Array.isArray(aiData.education) && aiData.education.length > 0
        ? aiData.education.map((e: Record<string, string>, i: number) => ({
            id: String(i + 1),
            degree: e.degree || '',
            school: e.school || '',
            location: e.location || '',
            startDate: e.startDate || '',
            endDate: e.endDate || '',
            description: e.description || '',
          }))
        : cvData.education;

      const aiStages = Array.isArray(aiData.stages) && aiData.stages.length > 0
        ? aiData.stages.map((e: Record<string, string>, i: number) => ({
            id: String(i + 1),
            jobTitle: e.jobTitle || '',
            company: e.company || '',
            location: e.location || '',
            startDate: e.startDate || '',
            endDate: e.endDate || '',
            description: e.description || '',
          }))
        : cvData.stages;

      const aiSkills = Array.isArray(aiData.skills) && aiData.skills.length > 0
        ? aiData.skills.map((s: Record<string, string>) => ({ name: s.name || '', level: s.level }))
        : cvData.skills.length > 0
          ? cvData.skills
          : rawSkills.split(/[,\n]+/).map((s) => s.trim()).filter(Boolean).map((s) => ({ name: s }));

      const aiLanguages = Array.isArray(aiData.languages) && aiData.languages.length > 0
        ? aiData.languages.map((l: Record<string, string>) => ({ name: l.name || '', level: l.level || '' }))
        : cvData.languages;

      const aiCertifications = Array.isArray(aiData.certifications) && aiData.certifications.length > 0
        ? aiData.certifications.map((c: Record<string, string>) => ({ name: c.name || '', issuer: c.issuer || '', date: c.date || '' }))
        : cvData.certifications;

      const output = {
        adaptedCV: {
          personalInfo: cvData.personalInfo,
          summary: aiData.summary || '',
          experiences: aiExperiences,
          stages: aiStages,
          education: aiEducation,
          skills: aiSkills,
          languages: aiLanguages,
          certifications: aiCertifications,
        },
        motivationLetter: aiData.motivationLetter || '',
        candidacyEmail: aiData.candidacyEmail || '',
        latexCode: aiData.latexCode || '',
      };

      setGeneratedOutput(output);

      // Auto-save to Supabase if user is logged in
      if (user) {
        saveCV(undefined, output).catch(() => {});
      }

      setCurrentStep(5);
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasStructuredExperience = (cvData.experiences ?? []).some((e) => e.jobTitle && e.company);
  const hasStructuredEducation = (cvData.education ?? []).some((e) => e.degree && e.school);

  const canGoNext = () => {
    switch (currentStep) {
      case 1:
        return cvData.personalInfo.firstName && cvData.personalInfo.lastName && (rawResume.length > 20 || hasStructuredExperience || hasStructuredEducation);
      case 2:
        return rawSkills.length > 5 || (cvData.skills ?? []).length > 0;
      case 3:
        return jobOffer.length > 30;
      case 4:
        return !!selectedTemplate;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (currentStep < 5) setCurrentStep((currentStep + 1) as BuilderStep);
  };

  const goPrev = () => {
    if (currentStep > 1) setCurrentStep((currentStep - 1) as BuilderStep);
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1: return <Step1Profile />;
      case 2: return <Step2Skills />;
      case 3: return <Step3JobOffer />;
      case 4: return <Step4Template />;
      case 5: return <Step5Results />;
      default: return null;
    }
  };

  return (
    <>
      <Navbar />
      <main className="flex-1">

        {/* Hero */}
        <section id="hero" className="py-16 md:py-24">
          <div className="max-w-2xl mx-auto px-5 text-center">
            <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 leading-tight">
              {t('home.heroTitle')}{' '}
              <span className="text-blue-600">{t('home.heroTitleHighlight')}</span>
            </h1>
          </div>
        </section>

        {/* Builder */}
        <section id="builder" className="scroll-mt-16 pb-16">
          <div className="max-w-2xl mx-auto px-5">

            {/* Step indicator */}
            <StepIndicator />

            {/* Step description */}
            <p className="text-sm text-gray-400 mb-6">{t(`builder.step${currentStep}Desc`)}</p>

            {/* Step content */}
            <div className="mb-6">
              {renderStep()}
            </div>

            {/* Error */}
            {generationError && (
              <div className="mb-6 p-4 rounded-lg bg-red-50 text-red-600 text-sm flex items-center justify-between">
                <span>{generationError}</span>
                <button onClick={handleGenerate} className="ml-4 shrink-0 text-xs font-medium underline hover:no-underline">{t('common.retry')}</button>
              </div>
            )}

            {/* Navigation */}
            {currentStep < 5 && (
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <button
                  onClick={goPrev}
                  disabled={currentStep === 1}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-gray-900 disabled:opacity-0 disabled:cursor-default transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t('builder.previous')}
                </button>

                {currentStep === 4 ? (
                  <button
                    onClick={handleGenerate}
                    disabled={!canGoNext() || isGenerating}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                    className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {t('builder.next')}
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Ad */}
            {currentStep <= 3 && (
              <div className="mt-10">
                <AdBanner
                  adKey={process.env.NEXT_PUBLIC_ADSTERRA_BANNER_KEY || ''}
                  format="banner"
                  width={728}
                  height={90}
                />
              </div>
            )}
          </div>
        </section>

      </main>
      <Footer />
      <AdBanner adKey={process.env.NEXT_PUBLIC_ADSTERRA_SOCIAL_BAR_KEY || ''} format="social-bar" />
    </>
  );
}
