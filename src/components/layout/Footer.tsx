'use client';

import { useTranslations } from '@/lib/i18n';

export default function Footer() {
  const { t } = useTranslations();

  return (
    <footer className="mt-auto border-t border-gray-100">
      <div className="max-w-2xl mx-auto px-5 py-8 text-center">
        <p className="text-sm text-gray-400">
          © {new Date().getFullYear()} CVzzer — {t('footer.madeWith')}
        </p>
      </div>
    </footer>
  );
}
