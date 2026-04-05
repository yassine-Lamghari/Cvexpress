/**
 * Centralized template configuration.
 * Single source of truth for all allowed template IDs.
 * Used across cv-store migrations, registry, and API endpoints.
 *
 * NOTE: Keep in sync with api/templates.json
 * The JSON file is the canonical source for the PHP backend.
 */

export const ALLOWED_TEMPLATES = [
  'rezume',
  'modern_image',
] as const;

export type TemplateId = typeof ALLOWED_TEMPLATES[number];

/** Runtime validation that a template ID is in the allowed list */
export function isValidTemplateId(id: string): id is TemplateId {
  return (ALLOWED_TEMPLATES as readonly string[]).includes(id);
}

