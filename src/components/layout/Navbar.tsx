'use client';

import { useState, useRef, useEffect } from 'react';
import { Globe, User, LogOut, Settings, ChevronDown, ListVideo, History } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useCVStore } from '@/stores/cv-store';
import { useAuth } from '@/components/auth/AuthProvider';
import AuthModal from '@/components/auth/AuthModal';
import SettingsModal from '@/components/auth/SettingsModal';
import HistoryModal from '@/components/history/HistoryModal';

export default function Navbar() {
  const { locale, t } = useTranslations();
  const setLocale = useCVStore((s) => s.setLocale);
  const { user, signOut, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleLocale = () => {
    setLocale(locale === 'fr' ? 'en' : 'fr');
  };

  const getDisplayName = () => {
    if (!user) return '';
    const meta = user.user_metadata;
    if (meta?.full_name) return meta.full_name;
    if (meta?.first_name) return `${meta.first_name} ${meta.last_name || ''}`.trim();
    return user.email?.split('@')[0] || 'Utilisateur';
  };

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
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
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen(!dropdownOpen)}
                    className="flex items-center gap-2 hover:bg-gray-50 p-1 pr-2 rounded-full transition-colors"
                  >
                    {getAvatarUrl() ? (
                      <img 
                        src={getAvatarUrl()} 
                        alt="Avatar" 
                        className="w-7 h-7 rounded-full object-cover border border-gray-200"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-semibold text-xs border border-blue-200">
                        {getDisplayName().charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-700 hidden sm:block">
                      {getDisplayName()}
                    </span>
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>

                  {dropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50">
                      <div className="px-4 py-2 border-b border-gray-100 sm:hidden">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {getDisplayName()}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {user.email}
                        </p>
                      </div>
                      
                      <button
                        onClick={() => {
                          setHistoryOpen(true);
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <History className="w-4 h-4 text-gray-400" />
                        Mes CVs
                      </button>

                      <button
                        onClick={() => {
                          setSettingsOpen(true);
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                      >
                        <Settings className="w-4 h-4 text-gray-400" />
                        Paramètres
                      </button>
                      
                      <button
                        onClick={() => {
                          signOut();
                          setDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4 text-red-400" />
                        Déconnexion
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setAuthOpen(true)}
                  className="flex items-center gap-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors bg-gray-50 hover:bg-gray-100 px-3 py-1.5 rounded-lg"
                >
                  <User className="w-4 h-4" />
                  {t('auth.signIn')}
                </button>
              )
            )}
          </div>
        </div>
      </header>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HistoryModal open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  );
}
