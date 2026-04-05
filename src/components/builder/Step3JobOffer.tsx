'use client';

import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';

export default function Step3JobOffer() {
  const { t } = useTranslations();
  const { jobOffer, setJobOffer } = useCVStore();

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          {t('builder.jobOffer')}
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          {t('builder.jobOfferHint')}
        </p>
        <textarea
          value={jobOffer}
          onChange={(e) => setJobOffer(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900 bg-white resize-y min-h-[200px] h-64"
          placeholder={t('builder.jobOfferPlaceholder')}
        />
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span>{jobOffer.length} {t('builder.characters')}</span>
          <span>~{Math.ceil(jobOffer.split(/\s+/).filter(Boolean).length)} {t('builder.words')}</span>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-50 rounded-md p-5 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">{t('builder.tipsTitle')}</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• {t('builder.tip1')}</li>
          <li>• {t('builder.tip2')}</li>
          <li>• {t('builder.tip3')}</li>
          <li>• {t('builder.tip4')}</li>
        </ul>
      </div>
    </div>
  );
}
