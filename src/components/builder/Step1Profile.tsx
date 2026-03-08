'use client';

import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import { useRef } from 'react';

export default function Step1Profile() {
  const { t } = useTranslations();
  const { cvData, setPersonalInfo, rawResume, setRawResume } = useCVStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return; // 5MB max
    const reader = new FileReader();
    reader.onload = () => {
      setPersonalInfo({ photo: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPersonalInfo({ photo: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* Photo Upload */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          {t('builder.photo')}
        </h3>
        <div className="flex items-center gap-5">
          <div
            className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-gray-400 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {cvData.personalInfo.photo ? (
              <img
                src={cvData.personalInfo.photo}
                alt="Photo"
                className="w-full h-full object-cover"
              />
            ) : (
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-sm text-gray-700 hover:text-gray-900 underline"
            >
              {cvData.personalInfo.photo ? t('builder.changePhoto') : t('builder.uploadPhoto')}
            </button>
            {cvData.personalInfo.photo && (
              <button
                type="button"
                onClick={removePhoto}
                className="text-sm text-red-500 hover:text-red-700"
              >
                {t('builder.removePhoto')}
              </button>
            )}
            <p className="text-xs text-gray-400">JPG, PNG — max 5 MB</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoUpload}
            className="hidden"
          />
        </div>
      </div>

      {/* Personal Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          {t('builder.personalInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.firstName')}
            </label>
            <input
              type="text"
              value={cvData.personalInfo.firstName}
              onChange={(e) => setPersonalInfo({ firstName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="Jean"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.lastName')}
            </label>
            <input
              type="text"
              value={cvData.personalInfo.lastName}
              onChange={(e) => setPersonalInfo({ lastName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="Dupont"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.email')}
            </label>
            <input
              type="email"
              value={cvData.personalInfo.email}
              onChange={(e) => setPersonalInfo({ email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="jean.dupont@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.phone')}
            </label>
            <input
              type="tel"
              value={cvData.personalInfo.phone}
              onChange={(e) => setPersonalInfo({ phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="+33 6 12 34 56 78"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.city')}
            </label>
            <input
              type="text"
              value={cvData.personalInfo.city}
              onChange={(e) => setPersonalInfo({ city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="Paris"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.country')}
            </label>
            <input
              type="text"
              value={cvData.personalInfo.country}
              onChange={(e) => setPersonalInfo({ country: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="France"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.jobTitle')}
            </label>
            <input
              type="text"
              value={cvData.personalInfo.title || ''}
              onChange={(e) => setPersonalInfo({ title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="Développeur Full Stack"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('builder.linkedin')}
            </label>
            <input
              type="url"
              value={cvData.personalInfo.linkedin || ''}
              onChange={(e) => setPersonalInfo({ linkedin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
              placeholder="https://linkedin.com/in/jeandupont"
            />
          </div>
        </div>
      </div>

      {/* Resume/Experiences */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          {t('builder.resume')}
        </h3>
        <textarea
          value={rawResume}
          onChange={(e) => setRawResume(e.target.value)}
          rows={10}
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors resize-y text-sm text-gray-900"
          placeholder={t('builder.resumePlaceholder')}
        />
        <p className="text-xs text-gray-400 mt-1.5">
          Collez tout votre parcours : expériences, formations, projets... L&apos;IA s&apos;occupe de tout organiser.
        </p>
      </div>
    </div>
  );
}
