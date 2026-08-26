import { postProcessLatex, validateBraceBalance, validateResumeSubheading } from './latexProcessor';

interface AiGenerationResult {
  latexCode?: string;
  motivationLetter?: string;
  candidacyEmail?: string;
  [key: string]: unknown;
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
