'use client';

import { Globe } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useCVStore } from '@/stores/cv-store';

export default function Navbar() {
  const { locale } = useTranslations();
  const setLocale = useCVStore((s) => s.setLocale);

  const toggleLocale = () => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  };

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
      <div className="max-w-2xl mx-auto px-5 flex items-center justify-between h-14">
        <a href="#hero" className="text-base font-semibold text-gray-900">
          CV Express IA
        </a>
        <button
          onClick={toggleLocale}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          {locale === 'fr' ? 'EN' : 'FR'}
        </button>
      </div>
    </header>
  );
}
