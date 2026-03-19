import type { TemplateInfo } from '@/types/cv';

export const templateList: TemplateInfo[] = [
  {
    id: 'professional',
    name: 'Professional',
    description: 'Vaishanth — colonne unique, airforce blue, CormorantGaramond/Charter, style ingénieur',
    thumbnail: '/templates/professional-thumb.png',
    tags: ['professionnel', 'ingénieur', 'compact'],
    primaryColor: '#0E5484',
  },
  {
    id: 'charles',
    name: 'Charles',
    description: "Charles Rambo — photo circulaire, Palatino, A4, style académique européen",
    thumbnail: '/templates/charles-thumb.png',
    tags: ['photo', 'académique', 'européen'],
    primaryColor: '#333333',
  },
  {
    id: 'rezume',
    name: 'Rezume',
    description: 'Nanu — Source Sans Pro, sections bleues, style développeur moderne',
    thumbnail: '/templates/rezume-thumb.png',
    tags: ['développeur', 'moderne', 'bleu'],
    primaryColor: '#0000FF',
  },
  {
    id: 'modern_image',
    name: 'Moderne avec Image',
    description: 'Template moderne basé sur Professional, avec intégration de photo de profil',
    thumbnail: '/templates/professional-thumb.png',
    tags: ['photo', 'moderne', 'professionnel'],
    primaryColor: '#0E5484',
  },
  {
    id: 'one_and_half_column',
    name: '1.5 Column',
    description: 'Template CV 1.5 colonnes avec photo, icônes, et style Roboto',
    thumbnail: '/templates/professional-thumb.png',
    tags: ['photo', 'moderne', 'colonnes'],
    primaryColor: '#000000',
  },
];

export function getTemplateInfo(templateId: string): TemplateInfo | undefined {
  return templateList.find((t) => t.id === templateId);
}
