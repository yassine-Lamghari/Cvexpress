'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { FaFacebook } from 'react-icons/fa';
import { useAuth } from './AuthProvider';
import { useTranslations } from '@/lib/i18n';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
}

export default function AuthModal({ open, onClose }: AuthModalProps) {
  const { t } = useTranslations();
  const { signIn, signUp, signInWithOAuth } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = mode === 'login'
      ? await signIn(email, password)
      : await signUp(email, password, firstName, lastName);

    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onClose();
    }
  };

  const handleOAuth = async (provider: 'google' | 'facebook') => {
    setError(null);
    setLoading(true);
    const result = await signInWithOAuth(provider);
    if (result.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          {mode === 'login' ? t('auth.signIn') : t('auth.signUp')}
        </h2>

        <div className="space-y-3 mb-4">
          <button
            onClick={() => handleOAuth('google')}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <FcGoogle className="w-5 h-5" />
            <span>Google</span>
          </button>
          
          <button
              onClick={() => handleOAuth('facebook')}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 text-[#1877F2]"
            >
              <FaFacebook className="w-5 h-5" />
              <span>Facebook</span>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder={t('auth.firstName')}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder={t('auth.lastName')}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          <input
            type="email"
            required
            placeholder={t('auth.email')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <input
            type="password"
            required
            minLength={6}
            placeholder={t('auth.password')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gray-900 text-white text-sm font-medium rounded-lg py-2.5 hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {loading ? '...' : mode === 'login' ? t('auth.signIn') : t('auth.signUp')}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          {mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}{' '}
          <button
            onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(null); }}
            className="text-blue-600 hover:underline"
          >
            {mode === 'login' ? t('auth.createAccount') : t('auth.loginHere')}
          </button>
        </p>
      </div>
    </div>
  );
}
