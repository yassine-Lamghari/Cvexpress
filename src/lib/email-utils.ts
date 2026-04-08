const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

export function extractFirstEmailFromText(text: string): string | null {
  const matches = text.match(emailRegex);
  if (!matches || matches.length === 0) {
    return null;
  }

  return matches[0].trim().toLowerCase();
}
