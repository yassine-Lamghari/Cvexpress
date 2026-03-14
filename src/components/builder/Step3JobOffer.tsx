'use client';

import { useState } from 'react';
import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import { JobOffer } from '@/types/cv';

export default function Step3JobOffer() {
  const { t } = useTranslations();
  const { jobOffer, setJobOffer } = useCVStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [jobOffers, setJobOffers] = useState<JobOffer[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchJobs = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setJobOffers([]);
    
    try {
      const res = await fetch(`/api/jobs?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setJobOffers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          Recherche d'offres (Mock)
        </h3>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900 bg-white"
            placeholder="Ex: Développeur React"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && searchJobs()}
          />
          <button
            onClick={searchJobs}
            disabled={isSearching || !searchQuery.trim()}
            className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSearching ? 'Recherche...' : 'Rechercher'}
          </button>
        </div>

        {jobOffers.length > 0 && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6 max-h-64 overflow-y-auto">
            <h4 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">
              Dernières offres ({jobOffers.length})
            </h4>
            <div className="space-y-3">
              {jobOffers.map((offer) => (
                <div
                  key={offer.id}
                  onClick={() => setJobOffer(offer.description)}
                  className="bg-white border border-gray-200 p-3 rounded-md hover:border-gray-400 cursor-pointer transition-colors shadow-sm"
                >
                  <div className="font-medium text-gray-900 text-sm">{offer.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {offer.company} • {offer.location}
                  </div>
                  <div className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {offer.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
          rows={16}
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors resize-y text-sm text-gray-900 bg-white"
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
