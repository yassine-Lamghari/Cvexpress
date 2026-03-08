'use client';

import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';

export default function StepIndicator() {
  const { t } = useTranslations();
  const { currentStep, setCurrentStep } = useCVStore();

  const steps = [
    { num: 1, label: t('builder.step1Title') },
    { num: 2, label: t('builder.step2Title') },
    { num: 3, label: t('builder.step3Title') },
    { num: 4, label: t('builder.step4Title') },
    { num: 5, label: t('builder.step5Title') },
  ];

  return (
    <div className="flex items-center gap-1 mb-8">
      {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center gap-1 flex-1">
          <button
            type="button"
            onClick={() => setCurrentStep(step.num as 1 | 2 | 3 | 4 | 5)}
            className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                currentStep > step.num
                  ? 'bg-gray-900 text-white'
                  : currentStep === step.num
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              {currentStep > step.num ? '✓' : step.num}
            </span>
            <span className={`text-xs hidden sm:block ${
              currentStep >= step.num ? 'text-gray-900' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
          </button>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-px mx-1 ${
              currentStep > step.num ? 'bg-gray-300' : 'bg-gray-100'
            }`} />
          )}
        </div>
      ))}
    </div>
  );
}
