import fs from 'fs/promises';
import path from 'path';

/**
 * Loads a LaTeX template from the public/templates directory.
 * @param templateName - The ID of the template (e.g., 'rezume')
 * @returns The raw LaTeX string
 */
export async function loadTemplate(templateName: string): Promise<string> {
  const pathsToTry = [
    path.join(process.cwd(), 'src', 'app', 'api', 'templates', `${templateName}.tex`),
    path.join(process.cwd(), 'src', 'templates', `${templateName}.tex`),
    path.join(process.cwd(), 'public', 'templates', `${templateName}.tex`),
  ];

  for (const texPath of pathsToTry) {
    try {
      const template = await fs.readFile(texPath, 'utf8');
      return template;
    } catch (e) {
      continue;
    }
  }
  
  throw new Error(`Template file not found: ${templateName} checked multiple paths.`);
}