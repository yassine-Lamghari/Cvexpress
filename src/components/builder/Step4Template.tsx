'use client';

import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import { Check } from 'lucide-react';
import { templateList } from '@/templates/registry';

const accentColors: Record<string, string> = {
  rezume: '#0000FF',
  modern_image: '#0E5484',
};

export default function Step4Template() {
  const { t } = useTranslations();
  const { selectedTemplate, setSelectedTemplate } = useCVStore();

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">
          {t('builder.step4Title')}
        </h3>
        <p className="text-sm text-gray-500 mb-6">{t('builder.step4Desc')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {templateList.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          const nameKey = `templates.${tmpl.id}` as any;
          const descKey = `templates.${tmpl.id}Desc` as any;
          const accent = accentColors[tmpl.id] || '#0E5484';

          return (
            <button
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.id)}
              className={`group flex flex-col relative text-left rounded-2xl border-2 transition-all duration-300 ease-in-out bg-white overflow-hidden ${
                isSelected
                  ? 'border-indigo-600 shadow-[0_8px_30px_rgb(0,0,0,0.12)] ring-4 ring-indigo-50/50 scale-[1.02] transform'
                  : 'border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1'
              }`}
            >
              {/* Template Preview Illustration */}
              <div className="bg-slate-50 relative aspect-[4/5] w-full flex flex-col items-center justify-center p-8 border-b border-slate-100">
                <div className={`bg-white shadow-[0_2px_15px_-3px_rgba(0,0,0,0.07),0_10px_20px_-2px_rgba(0,0,0,0.04)] w-full h-full flex flex-col rounded-sm overflow-hidden transition-transform duration-500 ease-out p-4 ${
                  isSelected ? 'scale-[1.03]' : 'group-hover:scale-[1.03]'
                }`}>
                  
                  {/* Header Preview */}
                  <div className="flex items-center gap-3 mb-6">
                    {tmpl.id === 'modern_image' && (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="h-3.5 w-1/2 rounded-full mb-2.5" style={{ backgroundColor: accent }} />
                      <div className="h-1.5 w-1/3 rounded-full bg-slate-300 mb-1.5" />
                      <div className="h-1.5 w-1/4 rounded-full bg-slate-200" />
                    </div>
                  </div>
                  
                  {/* Body Preview */}
                  <div className="space-y-6 pt-3 border-t border-slate-100 flex-1">
                    <div className="space-y-2.5">
                       <div className="h-2.5 w-16 rounded-full" style={{ backgroundColor: accent }} />
                       <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                       <div className="h-1.5 w-5/6 bg-slate-100 rounded-full" />
                    </div>
                    <div className="space-y-2.5">
                       <div className="h-2.5 w-20 rounded-full" style={{ backgroundColor: accent }} />
                       <div className="h-1.5 w-full bg-slate-100 rounded-full" />
                       <div className="h-1.5 w-11/12 bg-slate-100 rounded-full" />
                       <div className="h-1.5 w-4/5 bg-slate-100 rounded-full" />
                    </div>
                  </div>

                </div>

                {/* Selection Badge */}
                <div className={`absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${
                  isSelected ? 'bg-indigo-600 scale-100 opacity-100' : 'scale-75 opacity-0 bg-transparent'
                }`}>
                  <Check className="w-5 h-5 text-white" strokeWidth={3} />
                </div>
              </div>

              {/* Template Info Content */}
              <div className="p-6 bg-white flex-1 flex flex-col justify-center">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-lg font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">
                    {t(nameKey)}
                  </h4>
                  {isSelected && (
                    <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full inline-block">
                      Sélectionné
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-500 leading-relaxed">
                  {t(descKey) || tmpl.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
