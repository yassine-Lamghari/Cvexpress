'use client';

import { useMemo } from 'react';
import { LatexCodePreview } from '@/components/preview/registry';
import { parseLaTeXSections, type ParsedSection } from '@/lib/latex-parser';

interface ClickablePreviewProps {
  latexCode: string;
  template: string;
  photo?: string;
  locale: string;
  onSectionClick: (section: ParsedSection, rect: DOMRect) => void;
  activeSection?: string | null;
}

const SECTION_LABELS: Record<string, Record<string, string>> = {
  Header: { fr: 'En-tÃªte', en: 'Header' },
};

export default function ClickablePreview({ latexCode, template, photo, locale, onSectionClick, activeSection }: ClickablePreviewProps) {
  const sections = useMemo(() => parseLaTeXSections(latexCode), [latexCode]);

  // Calculate cumulative positions (top %) from heightRatios
  const zones = useMemo(() => {
    let top = 0;
    return sections.map((sec) => {
      const zone = { section: sec, top, height: sec.heightRatio * 100 };
      top += sec.heightRatio * 100;
      return zone;
    });
  }, [sections]);

  const handleZoneClick = (section: ParsedSection, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    onSectionClick(section, rect);
  };

  const getLabel = (name: string) => {
    const labels = SECTION_LABELS[name];
    return labels ? labels[locale] || name : name;
  };

  return (
    <div className="relative w-full">
      {/* PDF Preview */}
      <div style={{ aspectRatio: '210 / 297' }}>
          <LatexCodePreview latexCode={latexCode} template={template} photo={photo} />
      </div>

      {/* Clickable zone overlay */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {zones.map((zone) => (
          <div
            key={zone.section.id}
            onClick={(e) => handleZoneClick(zone.section, e)}
            className={`absolute left-[4%] right-[4%] group cursor-pointer transition-all duration-150 ${
              activeSection === zone.section.id
                ? 'bg-blue-500/15 border border-blue-500/50 rounded-sm'
                : 'hover:bg-blue-500/10 hover:border hover:border-blue-400/40 hover:rounded-sm'
            }`}
            style={{
              top: `${zone.top}%`,
              height: `${zone.height}%`,
              pointerEvents: 'auto',
            }}
          >
            {/* Section label on hover */}
            <span
              className={`absolute top-0.5 left-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-opacity ${
                activeSection === zone.section.id
                  ? 'bg-blue-500 text-white opacity-100'
                  : 'bg-blue-500/80 text-white opacity-0 group-hover:opacity-100'
              }`}
            >
              {getLabel(zone.section.name)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
