'use client';

import { useCVStore } from '@/stores/cv-store';
import { useTranslations } from '@/lib/i18n';
import { Check } from 'lucide-react';
import Image from 'next/image';
import { templateList } from '@/templates/registry';

const templates = templateList.map((t) => ({
  id: t.id,
  image: `/templates/${t.id}.jpeg`,
}));

export default function Step4Template() {
  const { t } = useTranslations();
  const { selectedTemplate, setSelectedTemplate } = useCVStore();

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">
          {t('builder.step4Title')}
        </h3>
        <p className="text-sm text-gray-500 mb-6">{t('builder.step4Desc')}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {templates.map((tmpl) => {
          const isSelected = selectedTemplate === tmpl.id;
          const nameKey = `templates.${tmpl.id}` as string;
          const descKey = `templates.${tmpl.id}Desc` as string;

          return (
            <button
              key={tmpl.id}
              onClick={() => setSelectedTemplate(tmpl.id)}
              className={`relative text-left rounded-lg border-2 transition-all overflow-hidden ${
                isSelected
                  ? 'border-gray-900 shadow-lg scale-[1.02]'
                  : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
              }`}
            >
              {/* Template image preview */}
              <div className="bg-gray-50 relative">
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    src={tmpl.image}
                    alt={tmpl.id}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
                  />
                </div>
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-gray-900 rounded-full flex items-center justify-center">
                    <Check className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3 border-t border-gray-100">
                <h4 className="text-sm font-semibold text-gray-900">{t(nameKey)}</h4>
                <p className="text-xs text-gray-500 mt-0.5">{t(descKey)}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
