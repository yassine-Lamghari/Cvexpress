'use client';

import { useState } from 'react';
import { Globe, User, LogOut } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useCVStore } from '@/stores/cv-store';
import { useAuth } from '@/components/auth/AuthProvider';
import AuthModal from '@/components/auth/AuthModal';

export default function Navbar() {
  const { locale, t } = useTranslations();
  const setLocale = useCVStore((s) => s.setLocale);
  const { user, signOut, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);

  const toggleLocale = () => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-5 flex items-center justify-between h-14">
          <a href="/" className="text-base font-semibold text-gray-900">
            CV Express IA
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
            >
              <Globe className="w-3.5 h-3.5" />
              {locale === 'fr' ? 'EN' : 'FR'}
            </button>

            {!loading && (
              user ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 hidden sm:inline">
                    {user.email}
                  </span>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-900 transition-colors"
                    title={t('auth.signOut')}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <User className="w-3.5 h-3.5" />
                  {t('auth.signIn')}
                </button>
              )
            )}
          </div>
        </div>
      </header>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
