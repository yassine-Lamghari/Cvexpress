import { postProcessLatex, validateBraceBalance, validateResumeSubheading } from './latexProcessor';

interface AiGenerationResult {
  latexCode?: string;
  motivationLetter?: string;
  candidacyEmail?: string;
  [key: string]: unknown;
}

function repairLatexJsonEscapes(value: string): string {
  let repaired = '';

  for (let index = 0; index < value.length; index += 1) {
    const current = value[index];
    if (current !== '\\') {
      repaired += current;
      continue;
    }

    const next = value[index + 1];
    const afterNext = value[index + 2];
    if (!next) {
      repaired += '\\\\';
      continue;
    }

    // JSON escapes such as \n are valid, unless they are actually the beginning
    // of a LaTeX command (for example \newcommand or \textbf).
    const isLatexCommandStart = /[bfnrt]/.test(next) && /[A-Za-z@]/.test(afterNext || '');
    const isUnicodeEscape = next === 'u' && /^[0-9a-fA-F]{4}$/.test(value.slice(index + 2, index + 6));
    const isValidJsonEscape = next === '\\' || next === '"' || next === '/' ||
      (/[bfnrt]/.test(next) && !isLatexCommandStart) || isUnicodeEscape;

    if (isValidJsonEscape) {
      repaired += `\\${next}`;
      index += 1;
      continue;
    }

    repaired += '\\\\';
  }

  return repaired;
}

function parseAiJson(responseText: string): AiGenerationResult {
  let cleanedText = responseText.trim();
  const fenced = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    cleanedText = fenced[1];
  } else {
    cleanedText = cleanedText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
  }

  try {
    return JSON.parse(cleanedText) as AiGenerationResult;
  } catch (error) {
    try {
      return JSON.parse(repairLatexJsonEscapes(cleanedText)) as AiGenerationResult;
    } catch {
      // Fall back to extracting latexCode from partially formed JSON below.
    }
    const latexMatch = responseText.match(/"latexCode"\s*:\s*"([\s\S]*?)"(?=\s*(?:,|\}$))/m);
    if (latexMatch) {
      try {
        const latexCode = JSON.parse(`{"latexCode": "${latexMatch[1]}"}`).latexCode as string;
        return { latexCode };
      } catch {
        // Fall through to the normalized parsing error below.
      }
    }
    const detail = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Failed to parse AI response: ${detail}`);
  }
}

export function processAiGenerationResult(
  responseText: string,
  texTemplate: string,
  templateName: string,
  locale: 'fr' | 'en',
): AiGenerationResult {
  const parsed = parseAiJson(responseText);
  let latexOutput = typeof parsed.latexCode === 'string' ? parsed.latexCode : '';
  if (!latexOutput) {
    throw new Error('AI response does not contain latexCode');
  }

  if (texTemplate.includes('\\begin{document}') && latexOutput.includes('\\begin{document}')) {
    const originalPreamble = texTemplate.split('\\begin{document}')[0];
    const generatedBody = latexOutput.split('\\begin{document}').slice(1).join('\\begin{document}');
    latexOutput = `${originalPreamble}\\begin{document}${generatedBody}`;
  }

  if (!latexOutput.includes('\\begin{document}')) {
    throw new Error('AI response does not contain a complete LaTeX document');
  }

  latexOutput = postProcessLatex(latexOutput, templateName);
  latexOutput = validateBraceBalance(latexOutput);
  latexOutput = validateResumeSubheading(latexOutput);

  const babelLine = locale === 'fr' ? '\\usepackage[french]{babel}' : '\\usepackage[english]{babel}';
  if (!latexOutput.includes('\\usepackage[french]{babel}') && !latexOutput.includes('\\usepackage[english]{babel}')) {
    latexOutput = latexOutput.replace('\\begin{document}', `${babelLine}\n\\begin{document}`);
  }
  if (latexOutput.includes('french') && !latexOutput.includes('\\shorthandoff{,')) {
    latexOutput = latexOutput.replace(
      '\\begin{document}',
      '\\AtBeginDocument{\\shorthandoff{,}}\n\\begin{document}',
    );
  }
  if (!latexOutput.trim().endsWith('\\end{document}')) {
    latexOutput = `${latexOutput.trimEnd()}\n\\end{document}`;
  }

  return { ...parsed, latexCode: latexOutput };
}
