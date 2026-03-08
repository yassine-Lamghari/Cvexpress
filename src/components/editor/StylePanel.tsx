'use client';

import { useCVStore } from '@/stores/cv-store';
import { Palette, Type, AlignVerticalSpaceAround } from 'lucide-react';
import type { StyleOptions } from '@/types/cv';

const fontSizes: { value: StyleOptions['fontSize']; label: string }[] = [
  { value: 'small', label: 'S' },
  { value: 'medium', label: 'M' },
  { value: 'large', label: 'L' },
];

const spacings: { value: StyleOptions['spacing']; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal', label: 'Normal' },
  { value: 'relaxed', label: 'Aéré' },
];

export default function StylePanel() {
  const { styleOptions, setStyleOptions } = useCVStore();

  return (
    <div className="space-y-4">
      {/* Colors */}
      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <Palette className="w-3.5 h-3.5" />
          Couleurs
        </h4>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="color"
              value={styleOptions.primaryColor}
              onChange={(e) => setStyleOptions({ primaryColor: e.target.value })}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0"
            />
            <span className="text-xs text-gray-600">Primaire</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="color"
              value={styleOptions.secondaryColor}
              onChange={(e) => setStyleOptions({ secondaryColor: e.target.value })}
              className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0"
            />
            <span className="text-xs text-gray-600">Secondaire</span>
          </label>
        </div>
      </div>

      {/* Font Size */}
      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <Type className="w-3.5 h-3.5" />
          Taille de police
        </h4>
        <div className="flex gap-1">
          {fontSizes.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStyleOptions({ fontSize: value })}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                styleOptions.fontSize === value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Spacing */}
      <div>
        <h4 className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <AlignVerticalSpaceAround className="w-3.5 h-3.5" />
          Espacement
        </h4>
        <div className="flex gap-1">
          {spacings.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStyleOptions({ spacing: value })}
              className={`px-3 py-1.5 text-xs rounded border transition-colors ${
                styleOptions.spacing === value
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
