'use client';

import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';

export default function Step2Skills() {
  const { t } = useTranslations();
  const { cvData, addSkill, removeSkill, rawSkills, setRawSkills, addLanguage, removeLanguage } = useCVStore();
  const [skillInput, setSkillInput] = useState('');
  const [langName, setLangName] = useState('');
  const [langLevel, setLangLevel] = useState('');

  const handleAddSkill = () => {
    const trimmed = skillInput.trim();
    if (trimmed && !cvData.skills.find((s) => s.name === trimmed)) {
      addSkill({ name: trimmed });
      setSkillInput('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleAddLanguage = () => {
    if (langName.trim() && langLevel.trim()) {
      addLanguage({ name: langName.trim(), level: langLevel.trim() });
      setLangName('');
      setLangLevel('');
    }
  };

  return (
    <div className="space-y-8 animate-fadeInUp">
      {/* Raw Skills Input */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          {t('builder.skills')}
        </h3>
        <textarea
          value={rawSkills}
          onChange={(e) => setRawSkills(e.target.value)}
          rows={4}
          className="w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors resize-y text-sm text-gray-900 mb-4"
          placeholder={t('builder.skillsPlaceholder')}
        />
      </div>

      {/* Skill Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('builder.skillName')} — Ajoutez une par une (optionnel)
        </label>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={skillInput}
            onChange={(e) => setSkillInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
            placeholder="React, Python, Gestion de projet..."
          />
          <button
            onClick={handleAddSkill}
            className="px-4 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors flex items-center gap-1 text-sm"
          >
            <Plus className="w-4 h-4" />
            {t('builder.addSkill')}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cvData.skills.map((skill) => (
            <span
              key={skill.name}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium group"
            >
              {skill.name}
              <button
                onClick={() => removeSkill(skill.name)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Languages */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          Langues
        </h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={langName}
            onChange={(e) => setLangName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
            placeholder="Français, Anglais, Arabe..."
          />
          <input
            type="text"
            value={langLevel}
            onChange={(e) => setLangLevel(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900"
            placeholder="Natif, Courant, B2..."
          />
          <button
            onClick={handleAddLanguage}
            className="px-3 py-2 bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors flex items-center gap-1 text-sm"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {cvData.languages.map((lang) => (
            <span
              key={lang.name}
              className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-xs font-medium"
            >
              {lang.name} — {lang.level}
              <button
                onClick={() => removeLanguage(lang.name)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
