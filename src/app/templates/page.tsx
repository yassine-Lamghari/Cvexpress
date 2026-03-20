'use client';

import Link from 'next/link';
import { Check, Calendar, Tag } from 'lucide-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import AdBanner from '@/components/ads/AdBanner';
import { useTranslations } from '@/lib/i18n';
import { useCVStore } from '@/stores/cv-store';
import { templateList } from '@/templates/registry';

export default function TemplatesPage() {
  const { t } = useTranslations();
  const { selectedTemplate, setSelectedTemplate } = useCVStore();

  const accentMap: Record<string, string> = {
    professional: 'bg-[#0E5484]',
    charles: 'bg-gray-800',
    rezume: 'bg-amber-500',
    modern_image: 'bg-[#0E5484]',
    one_and_half_column: 'bg-black',
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
            <span className="text-gray-700 font-medium">{t('nav.templates')}</span>
          </nav>

          <div className="flex flex-col lg:flex-row gap-8">

            {/* Main content — left */}
            <aside className="flex-1 min-w-0 space-y-5">

              {/* Section header */}
              <div className="flex items-center gap-3 mb-6 pb-3 border-b-2 border-gray-900">
                <h1 className="text-sm font-bold text-gray-900 uppercase tracking-wider">{t('templates.title')}</h1>
              </div>

              <p className="text-sm text-gray-500 mb-6">{t('templates.description')}</p>

              {/* Templates as blog post cards */}
              <div className="space-y-5 mb-8">
                {templateList.map((tmpl) => {
                  const isSelected = selectedTemplate === tmpl.id;
                  const accent = accentMap[tmpl.id] || 'bg-amber-500';

                  return (
                    <article
                      key={tmpl.id}
                      className={`bg-white border rounded overflow-hidden transition-colors ${
                        isSelected ? 'border-gray-900' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row">
                        {/* Template preview — thumbnail */}
                        <div className="sm:w-48 shrink-0 bg-gray-50 p-5 flex items-center justify-center border-b sm:border-b-0 sm:border-r border-gray-100 relative">
                          <div className="bg-white border border-gray-200 rounded-sm p-3 w-28 aspect-[3/4] flex flex-col">
                            <div className={`h-1.5 w-12 rounded-sm ${accent} mb-1.5`}></div>
                            <div className="h-0.5 w-16 rounded-sm bg-gray-300 mb-0.5"></div>
                            <div className="h-0.5 w-12 rounded-sm bg-gray-200 mb-2"></div>
                            <div className="flex-1 space-y-1">
                              <div className="h-px w-full bg-gray-100"></div>
                              <div className="h-px w-full bg-gray-100"></div>
                              <div className="h-px w-3/4 bg-gray-100"></div>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 w-5 h-5 bg-gray-900 rounded-full flex items-center justify-center">
                              <Check className="w-3 h-3 text-white" />
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 p-5">
                          <div className="flex items-center gap-2 mb-2">
                            {tmpl.tags.map((tag) => (
                              <span key={tag} className="text-[10px] font-bold uppercase tracking-wider text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <h2 className="text-base font-semibold text-gray-900 mb-1">{tmpl.name}</h2>
                          <p className="text-sm text-gray-500 mb-4 leading-relaxed">{tmpl.description}</p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setSelectedTemplate(tmpl.id)}
                              className={`px-4 py-1.5 rounded text-xs font-medium transition-colors ${
                                isSelected
                                  ? 'bg-gray-900 text-white'
                                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                              }`}
                            >
                              {isSelected ? '✓ Sélectionné' : 'Sélectionner'}
                            </button>
                            <Link
                              href="/builder"
                              onClick={() => setSelectedTemplate(tmpl.id)}
                              className="px-4 py-1.5 rounded text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                            >
                              Utiliser ce template →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </aside>

            {/* Sidebar — right */}
            <div className="lg:w-64 shrink-0 space-y-5">

              {/* CTA widget */}
              <div className="bg-gray-900 text-white rounded p-5">
                <h3 className="text-sm font-bold mb-2">Créez votre CV</h3>
                <p className="text-xs text-gray-400 mb-3">Choisissez un template et générez votre CV adapté en 2 minutes.</p>
                <Link
                  href="/builder"
                  className="block w-full text-center bg-white text-gray-900 text-xs font-semibold py-2 rounded hover:bg-gray-100 transition-colors"
                >
                  Commencer →
                </Link>
              </div>

              {/* Info widget */}
              <div className="bg-white border border-gray-200 rounded p-4">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3 pb-2 border-b border-gray-200">À propos</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Nos templates sont conçus par des professionnels du recrutement. Chaque design est optimisé pour les ATS (Applicant Tracking Systems).
                </p>
              </div>

              {/* Ad */}
              <AdBanner
                adKey={process.env.NEXT_PUBLIC_ADSTERRA_NATIVE_KEY || ''}
                format="native"
                className="w-full"
              />

            </div>

          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
