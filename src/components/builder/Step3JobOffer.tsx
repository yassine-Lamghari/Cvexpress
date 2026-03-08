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
          Collez le texte complet de l&apos;offre d&apos;emploi. Plus l&apos;offre est détaillée, meilleur sera le résultat de l&apos;IA.
        </p>
        <textarea
          value={jobOffer}
          onChange={(e) => setJobOffer(e.target.value)}
          rows={16}
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors resize-y text-sm text-gray-900"
          placeholder={t('builder.jobOfferPlaceholder')}
        />
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          <span>📊 {jobOffer.length} caractères</span>
          <span>📝 ~{Math.ceil(jobOffer.split(/\s+/).filter(Boolean).length)} mots</span>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-gray-50 rounded-md p-5 border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-800 mb-2">Conseils pour un meilleur résultat</h4>
        <ul className="text-sm text-gray-600 space-y-1">
          <li>• Incluez le titre du poste, les missions et les compétences requises</li>
          <li>• Copiez l&apos;offre complète depuis LinkedIn, Indeed ou le site de l&apos;entreprise</li>
          <li>• Plus l&apos;offre est détaillée, plus le CV sera adapté</li>
          <li>• N&apos;hésitez pas à inclure la description de l&apos;entreprise</li>
        </ul>
      </div>
    </div>
  );
}
