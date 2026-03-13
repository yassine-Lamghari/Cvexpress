'use client';

import { useState, useRef, useEffect } from 'react';
import { X, Save, Plus, Trash2, Loader2 } from 'lucide-react';
import type { ParsedSection, ParsedEntry, SkillGroup } from '@/lib/latex-parser';

interface SectionEditPopoverProps {
  section: ParsedSection;
  anchorRect: DOMRect;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onSave: (instruction: string) => void;
  onClose: () => void;
  loading: boolean;
  locale: string;
}

export default function SectionEditPopover({ section, anchorRect, containerRef, onSave, onClose, loading, locale }: SectionEditPopoverProps) {
  const fr = locale === 'fr';
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 380 });

  // State per section type
  const [headerFields, setHeaderFields] = useState(section.headerFields || {});
  const [entries, setEntries] = useState<ParsedEntry[]>(section.entries ? JSON.parse(JSON.stringify(section.entries)) : []);
  const [skillGroups, setSkillGroups] = useState<SkillGroup[]>(section.skillGroups ? JSON.parse(JSON.stringify(section.skillGroups)) : []);
  const [textContent, setTextContent] = useState(section.textContent || '');
  const [items, setItems] = useState<string[]>(section.items ? [...section.items] : []);

  // Calculate position
  useEffect(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const popoverWidth = 380;

    // Position to the right of the preview if space, otherwise below
    const rightSpace = window.innerWidth - containerRect.right;
    const leftSpace = containerRect.left;

    let top = anchorRect.top - containerRect.top;
    let left: number;

    if (rightSpace >= popoverWidth + 16) {
      left = containerRect.width + 12;
    } else if (leftSpace >= popoverWidth + 16) {
      left = -popoverWidth - 12;
    } else {
      // Below the clicked zone
      top = anchorRect.bottom - containerRect.top + 8;
      left = 0;
    }

    // Clamp top
    top = Math.max(0, Math.min(top, containerRect.height - 300));

    setPosition({ top, left, width: popoverWidth });
  }, [anchorRect, containerRef]);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSave = () => {
    // Build instruction from the parser's buildEditInstruction
    // We import it dynamically to avoid circular deps at module level
    import('@/lib/latex-parser').then(({ buildEditInstruction }) => {
      const instruction = buildEditInstruction(section, {
        headerFields: section.type === 'header' ? headerFields : undefined,
        entries: section.type === 'entries' ? entries : undefined,
        skillGroups: section.type === 'skills' ? skillGroups : undefined,
        textContent: section.type === 'text' ? textContent : undefined,
        items: section.type === 'items' ? items : undefined,
      }, locale);

      if (instruction) {
        onSave(instruction);
      } else {
        onClose();
      }
    });
  };

  const updateEntry = (index: number, field: keyof ParsedEntry, value: string | string[]) => {
    const updated = [...entries];
    updated[index] = { ...updated[index], [field]: value };
    setEntries(updated);
  };

  const addEntry = () => {
    setEntries([...entries, { title: '', subtitle: '', date: '', location: '', bullets: [] }]);
  };

  const removeEntry = (index: number) => {
    setEntries(entries.filter((_, i) => i !== index));
  };

  const updateSkill = (index: number, field: keyof SkillGroup, value: string) => {
    const updated = [...skillGroups];
    updated[index] = { ...updated[index], [field]: value };
    setSkillGroups(updated);
  };

  const addSkill = () => {
    setSkillGroups([...skillGroups, { category: '', values: '' }]);
  };

  const removeSkill = (index: number) => {
    setSkillGroups(skillGroups.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItems([...items, '']);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  return (
    <div
      ref={popoverRef}
      className="absolute z-50 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        maxHeight: '70vh',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200 sticky top-0 z-10">
        <h3 className="text-sm font-semibold text-gray-900">{section.name}</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(70vh - 100px)' }}>
        {/* HEADER TYPE */}
        {section.type === 'header' && (
          <div className="space-y-3">
            <Field label={fr ? 'Nom' : 'Name'} value={headerFields.name || ''} onChange={(v) => setHeaderFields({ ...headerFields, name: v })} />
            <Field label={fr ? 'Titre / Poste' : 'Title / Position'} value={headerFields.title || ''} onChange={(v) => setHeaderFields({ ...headerFields, title: v })} />
            <Field label={fr ? 'Téléphone' : 'Phone'} value={headerFields.phone || ''} onChange={(v) => setHeaderFields({ ...headerFields, phone: v })} />
            <Field label="Email" value={headerFields.email || ''} onChange={(v) => setHeaderFields({ ...headerFields, email: v })} />
            <Field label="LinkedIn" value={headerFields.linkedin || ''} onChange={(v) => setHeaderFields({ ...headerFields, linkedin: v })} />
            <Field label="GitHub" value={headerFields.github || ''} onChange={(v) => setHeaderFields({ ...headerFields, github: v })} />
            <Field label={fr ? 'Site web' : 'Website'} value={headerFields.website || ''} onChange={(v) => setHeaderFields({ ...headerFields, website: v })} />
            <Field label={fr ? 'Localisation' : 'Location'} value={headerFields.location || ''} onChange={(v) => setHeaderFields({ ...headerFields, location: v })} />
          </div>
        )}

        {/* TEXT TYPE */}
        {section.type === 'text' && (
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={5}
            className="w-full text-sm border border-gray-200 rounded-md p-2.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
            placeholder={fr ? 'Contenu de la section...' : 'Section content...'}
          />
        )}

        {/* ENTRIES TYPE */}
        {section.type === 'entries' && (
          <div className="space-y-4">
            {entries.map((entry, idx) => (
              <div key={idx} className="border border-gray-200 rounded-md p-3 space-y-2 relative">
                <button
                  onClick={() => removeEntry(idx)}
                  className="absolute top-2 right-2 p-1 text-gray-300 hover:text-red-500 transition-colors"
                  title={fr ? 'Supprimer' : 'Remove'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Field label={fr ? 'Titre' : 'Title'} value={entry.title} onChange={(v) => updateEntry(idx, 'title', v)} />
                <Field label={fr ? 'Sous-titre' : 'Subtitle'} value={entry.subtitle} onChange={(v) => updateEntry(idx, 'subtitle', v)} />
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Date" value={entry.date} onChange={(v) => updateEntry(idx, 'date', v)} />
                  <Field label={fr ? 'Lieu' : 'Location'} value={entry.location} onChange={(v) => updateEntry(idx, 'location', v)} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{fr ? 'Points clés (un par ligne)' : 'Bullet points (one per line)'}</label>
                  <textarea
                    value={entry.bullets.join('\n')}
                    onChange={(e) => updateEntry(idx, 'bullets', e.target.value.split('\n'))}
                    rows={Math.max(2, entry.bullets.length)}
                    className="w-full text-xs border border-gray-200 rounded-md p-2 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                  />
                </div>
              </div>
            ))}
            <button
              onClick={addEntry}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors w-full justify-center py-2 border border-dashed border-blue-300 rounded-md hover:bg-blue-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {fr ? 'Ajouter une entrée' : 'Add entry'}
            </button>
          </div>
        )}

        {/* SKILLS TYPE */}
        {section.type === 'skills' && (
          <div className="space-y-3">
            {skillGroups.map((group, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <div className="flex-1 space-y-1">
                  <input
                    value={group.category}
                    onChange={(e) => updateSkill(idx, 'category', e.target.value)}
                    className="w-full text-xs font-medium border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder={fr ? 'Catégorie' : 'Category'}
                  />
                  <input
                    value={group.values}
                    onChange={(e) => updateSkill(idx, 'values', e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    placeholder={fr ? 'Compétences (séparées par virgule)' : 'Skills (comma-separated)'}
                  />
                </div>
                <button onClick={() => removeSkill(idx)} className="p-1 mt-1 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addSkill}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors w-full justify-center py-2 border border-dashed border-blue-300 rounded-md hover:bg-blue-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {fr ? 'Ajouter une catégorie' : 'Add category'}
            </button>
          </div>
        )}

        {/* ITEMS TYPE */}
        {section.type === 'items' && (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <span className="text-gray-400 mt-2 text-xs">•</span>
                <textarea
                  value={item}
                  onChange={(e) => {
                    const updated = [...items];
                    updated[idx] = e.target.value;
                    setItems(updated);
                  }}
                  rows={2}
                  className="flex-1 text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y"
                />
                <button onClick={() => removeItem(idx)} className="p-1 mt-1 text-gray-300 hover:text-red-500 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors w-full justify-center py-2 border border-dashed border-blue-300 rounded-md hover:bg-blue-50"
            >
              <Plus className="w-3.5 h-3.5" />
              {fr ? 'Ajouter un élément' : 'Add item'}
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50 sticky bottom-0">
        <button
          onClick={onClose}
          disabled={loading}
          className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
        >
          {fr ? 'Annuler' : 'Cancel'}
        </button>
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-gray-900 text-white rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {fr ? 'Mise à jour...' : 'Updating...'}
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              {fr ? 'Sauvegarder' : 'Save'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

/** Simple labeled input field */
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-500 mb-0.5 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
      />
    </div>
  );
}
