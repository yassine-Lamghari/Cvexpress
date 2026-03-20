'use client';

import { useState, useEffect } from 'react';
import { X, User, Lock, Settings } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useTranslations } from '@/lib/i18n';
import { useAuth } from '@/components/auth/AuthProvider';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export default function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { t } = useTranslations();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'advanced'>('profile');
  
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    if (user) {
      setFirstName(user.user_metadata?.first_name || '');
      setLastName(user.user_metadata?.last_name || '');
    }
  }, [user]);

  if (!open) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      data: { first_name: firstName, last_name: lastName, full_name: `${firstName} ${lastName}`.trim() }
    });

    setLoading(false);
    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: "Profil mis à jour avec succès !" });
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: "Les mots de passe ne correspondent pas." });
      return;
    }
    
    setLoading(true);
    setMessage(null);

    const { error } = await supabase.auth.updateUser({
      password: password
    });

    setLoading(false);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: "Mot de passe mis à jour avec succès !" });
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        onClose();
        setMessage(null);
      }, 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 flex overflow-hidden">
        
        {/* Sidebar Tabs */}
        <div className="w-1/3 bg-gray-50 border-r border-gray-100 p-4 flex flex-col gap-2">
          <h2 className="text-sm font-semibold text-gray-900 mb-2 px-2">Paramètres</h2>
          <button
            onClick={() => { setActiveTab('profile'); setMessage(null); }}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${activeTab === 'profile' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <User className="w-4 h-4" /> Profil
          </button>
          <button
            onClick={() => { setActiveTab('security'); setMessage(null); }}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${activeTab === 'security' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Lock className="w-4 h-4" /> Sécurité
          </button>
          <button
            onClick={() => { setActiveTab('advanced'); setMessage(null); }}
            className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg transition-colors ${activeTab === 'advanced' ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            <Settings className="w-4 h-4" /> Avancés
          </button>
        </div>

        {/* Content Area */}
        <div className="w-2/3 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>

          {activeTab === 'profile' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Profil Public</h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">L'email ne peut être changé que par le support pour l'instant.</p>
                </div>
                
                {message && activeTab === 'profile' && (
                  <p className={`text-xs ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                    {message.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gray-900 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? '...' : 'Enregistrer mon profil'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Mot de passe</h3>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Confirmer le mot de passe</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {message && activeTab === 'security' && (
                  <p className={`text-xs ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                    {message.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="bg-gray-900 text-white text-sm font-medium rounded-lg px-4 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  {loading ? '...' : 'Mettre à jour'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'advanced' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Paramètres Avancés</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Gérez vos données ou quittez la plateforme définitivement.
                </p>
              </div>

              <div className="border border-red-100 bg-red-50/50 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-red-700 mb-1">Supprimer toutes mes données</h4>
                <p className="text-xs text-gray-600 mb-3">
                  Cette action supprimera de manière irréversible tous vos CVs sauvegardés. Votre compte restera actif.
                </p>
                <button
                  onClick={async () => {
                    const confirm = window.confirm("Êtes-vous sûr de vouloir supprimer tous vos CVs ? Cette action est définitive.");
                    if (confirm && user) {
                      setLoading(true);
                      await supabase.from('cvs').delete().eq('user_id', user.id);
                      setMessage({ type: 'success', text: 'Toutes vos données (CVs) ont été supprimées.' });
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors"
                >
                  Effacer mes CVs
                </button>
              </div>

              <div className="border border-red-200 bg-red-50 rounded-xl p-4 mt-4">
                <h4 className="text-sm font-semibold text-red-800 mb-1">Zone de danger</h4>
                <p className="text-xs text-gray-600 mb-3">
                  ⚠️ Bien que vous soyez connecté avec Google/LinkedIn, ces actions sont déconseillées si vous souhaitez conserver un historique de vos générations.
                </p>
              </div>
              
              {message && activeTab === 'advanced' && (
                <p className={`text-xs ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
                  {message.text}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
