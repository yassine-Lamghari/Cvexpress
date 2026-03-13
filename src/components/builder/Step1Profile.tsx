'use client';

import { useState, useRef } from 'react';
import { Plus, X, ChevronDown, ChevronUp, Briefcase, GraduationCap, Building2 } from 'lucide-react';
import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-md focus:ring-1 focus:ring-gray-400 focus:border-gray-400 outline-none transition-colors text-sm text-gray-900 bg-white';

export default function Step1Profile() {
  const { t } = useTranslations();
  const {
    cvData, setPersonalInfo, rawResume, setRawResume,
    addExperience, removeExperience, updateExperience,
    addEducation, removeEducation, updateEducation,
    addStage, removeStage, updateStage,
  } = useCVStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    experiences: (cvData.experiences ?? []).length > 0,
    education: (cvData.education ?? []).length > 0,
    stages: (cvData.stages ?? []).length > 0,
  });

  const toggle = (key: string) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) return;
    const reader = new FileReader();
    reader.onload = () => setPersonalInfo({ photo: reader.result as string });
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
              <img src={cvData.personalInfo.photo} alt="Photo" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <button type="button" onClick={() => fileInputRef.current?.click()} className="text-sm text-gray-700 hover:text-gray-900 underline">
              {cvData.personalInfo.photo ? t('builder.changePhoto') : t('builder.uploadPhoto')}
            </button>
            {cvData.personalInfo.photo && (
              <button type="button" onClick={removePhoto} className="text-sm text-red-500 hover:text-red-700">{t('builder.removePhoto')}</button>
            )}
            <p className="text-xs text-gray-400">JPG, PNG — max 5 MB</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoUpload} className="hidden" />
        </div>
      </div>

      {/* Personal Info */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          {t('builder.personalInfo')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.firstName')}</label>
            <input type="text" value={cvData.personalInfo.firstName} onChange={(e) => setPersonalInfo({ firstName: e.target.value })} className={inputCls} placeholder="Jean" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.lastName')}</label>
            <input type="text" value={cvData.personalInfo.lastName} onChange={(e) => setPersonalInfo({ lastName: e.target.value })} className={inputCls} placeholder="Dupont" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.email')}</label>
            <input type="email" value={cvData.personalInfo.email} onChange={(e) => setPersonalInfo({ email: e.target.value })} className={inputCls} placeholder="jean.dupont@email.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.phone')}</label>
            <input type="tel" value={cvData.personalInfo.phone} onChange={(e) => setPersonalInfo({ phone: e.target.value })} className={inputCls} placeholder="+33 6 12 34 56 78" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.city')}</label>
            <input type="text" value={cvData.personalInfo.city} onChange={(e) => setPersonalInfo({ city: e.target.value })} className={inputCls} placeholder="Paris" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.country')}</label>
            <input type="text" value={cvData.personalInfo.country} onChange={(e) => setPersonalInfo({ country: e.target.value })} className={inputCls} placeholder="France" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.jobTitle')}</label>
            <input type="text" value={cvData.personalInfo.title || ''} onChange={(e) => setPersonalInfo({ title: e.target.value })} className={inputCls} placeholder="Développeur Full Stack" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('builder.linkedin')}</label>
            <input type="url" value={cvData.personalInfo.linkedin || ''} onChange={(e) => setPersonalInfo({ linkedin: e.target.value })} className={inputCls} placeholder="https://linkedin.com/in/jeandupont" />
          </div>
        </div>
      </div>

      {/* Raw Resume */}
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
          {t('builder.resume')}
        </h3>
        <textarea
          value={rawResume}
          onChange={(e) => setRawResume(e.target.value)}
          rows={8}
          className={`${inputCls} resize-y`}
          placeholder={t('builder.resumePlaceholder')}
        />
        <p className="text-xs text-gray-400 mt-1.5">{t('builder.resumeHint')}</p>
      </div>

      {/* ── Experiences ── */}
      <AccordionSection
        icon={<Briefcase className="w-4 h-4" />}
        title={t('builder.experiences')}
        count={(cvData.experiences ?? []).length}
        open={openSections.experiences}
        onToggle={() => toggle('experiences')}
      >
        {(cvData.experiences ?? []).map((exp) => (
          <EntryCard key={exp.id} onRemove={() => removeExperience(exp.id)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expJobTitle')}</label>
                <input type="text" value={exp.jobTitle} onChange={(e) => updateExperience(exp.id, { jobTitle: e.target.value })} className={inputCls} placeholder={t('builder.expJobTitlePh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expCompany')}</label>
                <input type="text" value={exp.company} onChange={(e) => updateExperience(exp.id, { company: e.target.value })} className={inputCls} placeholder={t('builder.expCompanyPh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expLocation')}</label>
                <input type="text" value={exp.location || ''} onChange={(e) => updateExperience(exp.id, { location: e.target.value })} className={inputCls} placeholder="Paris, France" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.startDate')}</label>
                  <input type="text" value={exp.startDate} onChange={(e) => updateExperience(exp.id, { startDate: e.target.value })} className={inputCls} placeholder="Jan. 2022" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.endDate')}</label>
                  <input type="text" value={exp.endDate} onChange={(e) => updateExperience(exp.id, { endDate: e.target.value })} className={inputCls} placeholder={t('builder.present')} />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expDescription')}</label>
              <textarea value={exp.description} onChange={(e) => updateExperience(exp.id, { description: e.target.value })} rows={3} className={`${inputCls} resize-y`} placeholder={t('builder.expDescriptionPh')} />
            </div>
          </EntryCard>
        ))}
        <button
          onClick={() => addExperience({ id: crypto.randomUUID(), jobTitle: '', company: '', location: '', startDate: '', endDate: '', description: '' })}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('builder.addExperience')}
        </button>
      </AccordionSection>

      {/* ── Education ── */}
      <AccordionSection
        icon={<GraduationCap className="w-4 h-4" />}
        title={t('builder.education')}
        count={(cvData.education ?? []).length}
        open={openSections.education}
        onToggle={() => toggle('education')}
      >
        {(cvData.education ?? []).map((edu) => (
          <EntryCard key={edu.id} onRemove={() => removeEducation(edu.id)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.eduDegree')}</label>
                <input type="text" value={edu.degree} onChange={(e) => updateEducation(edu.id, { degree: e.target.value })} className={inputCls} placeholder={t('builder.eduDegreePh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.eduSchool')}</label>
                <input type="text" value={edu.school} onChange={(e) => updateEducation(edu.id, { school: e.target.value })} className={inputCls} placeholder={t('builder.eduSchoolPh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expLocation')}</label>
                <input type="text" value={edu.location || ''} onChange={(e) => updateEducation(edu.id, { location: e.target.value })} className={inputCls} placeholder="Paris, France" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.startDate')}</label>
                  <input type="text" value={edu.startDate} onChange={(e) => updateEducation(edu.id, { startDate: e.target.value })} className={inputCls} placeholder="Sept. 2020" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.endDate')}</label>
                  <input type="text" value={edu.endDate} onChange={(e) => updateEducation(edu.id, { endDate: e.target.value })} className={inputCls} placeholder="Juin 2024" />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.eduDescription')}</label>
              <textarea value={edu.description || ''} onChange={(e) => updateEducation(edu.id, { description: e.target.value })} rows={2} className={`${inputCls} resize-y`} placeholder={t('builder.eduDescriptionPh')} />
            </div>
          </EntryCard>
        ))}
        <button
          onClick={() => addEducation({ id: crypto.randomUUID(), degree: '', school: '', location: '', startDate: '', endDate: '', description: '' })}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('builder.addEducation')}
        </button>
      </AccordionSection>

      {/* ── Stages / Internships ── */}
      <AccordionSection
        icon={<Building2 className="w-4 h-4" />}
        title={t('builder.stages')}
        count={(cvData.stages ?? []).length}
        open={openSections.stages}
        onToggle={() => toggle('stages')}
      >
        {(cvData.stages ?? []).map((stg) => (
          <EntryCard key={stg.id} onRemove={() => removeStage(stg.id)}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expJobTitle')}</label>
                <input type="text" value={stg.jobTitle} onChange={(e) => updateStage(stg.id, { jobTitle: e.target.value })} className={inputCls} placeholder={t('builder.stageJobTitlePh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expCompany')}</label>
                <input type="text" value={stg.company} onChange={(e) => updateStage(stg.id, { company: e.target.value })} className={inputCls} placeholder={t('builder.expCompanyPh')} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expLocation')}</label>
                <input type="text" value={stg.location || ''} onChange={(e) => updateStage(stg.id, { location: e.target.value })} className={inputCls} placeholder="Paris, France" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.startDate')}</label>
                  <input type="text" value={stg.startDate} onChange={(e) => updateStage(stg.id, { startDate: e.target.value })} className={inputCls} placeholder="Fév. 2023" />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.endDate')}</label>
                  <input type="text" value={stg.endDate} onChange={(e) => updateStage(stg.id, { endDate: e.target.value })} className={inputCls} placeholder="Juil. 2023" />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-500 mb-1">{t('builder.expDescription')}</label>
              <textarea value={stg.description} onChange={(e) => updateStage(stg.id, { description: e.target.value })} rows={3} className={`${inputCls} resize-y`} placeholder={t('builder.expDescriptionPh')} />
            </div>
          </EntryCard>
        ))}
        <button
          onClick={() => addStage({ id: crypto.randomUUID(), jobTitle: '', company: '', location: '', startDate: '', endDate: '', description: '' })}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-gray-300 rounded-md text-sm text-gray-500 hover:text-gray-900 hover:border-gray-400 transition-colors"
        >
          <Plus className="w-4 h-4" /> {t('builder.addStage')}
        </button>
      </AccordionSection>
    </div>
  );
}

/* â”€â”€ Reusable sub-components â”€â”€ */

function AccordionSection({ icon, title, count, open, onToggle, children }: {
  icon: React.ReactNode; title: string; count: number; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="text-gray-500">{icon}</span>
        <span className="text-sm font-semibold text-gray-900 uppercase tracking-wider flex-1">{title}</span>
        {count > 0 && <span className="text-xs font-medium text-white bg-gray-900 rounded-full w-5 h-5 flex items-center justify-center">{count}</span>}
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-4">{children}</div>}
    </div>
  );
}

function EntryCard({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="relative bg-white border border-gray-100 rounded-md p-4 group">
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Remove"
      >
        <X className="w-4 h-4" />
      </button>
      {children}
    </div>
  );
}
