import type { TemplateInfo } from '@/types/cv';
import { ALLOWED_TEMPLATES } from './config';

export const templateList: TemplateInfo[] = [
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
];

export function getTemplateInfo(templateId: string): TemplateInfo | undefined {
  return templateList.find((t) => t.id === templateId);
}
