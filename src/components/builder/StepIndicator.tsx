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

  const getTimeEstimate = () => {
    if (currentStep === 1) return "~ 5 min";
    if (currentStep === 2) return "~ 2 min";
    if (currentStep === 3) return "~ 1 min";
    if (currentStep === 4) return "~ 30 sec";
    return "Terminé";
  };

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
          Étape {currentStep} sur 5
        </h2>
        <span className="text-xs text-gray-500 font-medium">Temps estimé : {getTimeEstimate()}</span>
      </div>
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => (
        <div key={step.num} className="flex items-center gap-1 flex-1">
          <button
            type="button"
            onClick={() => setCurrentStep(step.num as 1 | 2 | 3 | 4 | 5)}
            className="group flex items-center gap-2 cursor-pointer transition-all"
          >
            <span
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all duration-300 ${
                currentStep > step.num
                  ? 'bg-gray-900 text-white shadow-md shadow-gray-200'
                  : currentStep === step.num
                  ? 'bg-gray-900 text-white ring-4 ring-gray-50 shadow-md shadow-gray-200'
                  : 'bg-gray-100 text-gray-500 group-hover:bg-gray-200'
              }`}
            >
              {currentStep > step.num ? '✓' : step.num}
            </span>
            <span className={`text-xs hidden sm:block font-medium transition-colors ${
              currentStep === step.num ? 'text-gray-900' : currentStep > step.num ? 'text-gray-800' : 'text-gray-400'
            }`}>
              {step.label}
            </span>
          </button>
          {idx < steps.length - 1 && (
            <div className={`flex-1 h-[2px] mx-2 rounded-full transition-colors duration-300 ${
              currentStep > step.num ? 'bg-gray-6-600' : 'bg-gray-100'
            }`} />
          )}
        </div>
      ))}
      </div>
    </div>
  );
}


