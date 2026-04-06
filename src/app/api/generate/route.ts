import { NextResponse } from 'next/server';
import path from 'path';
import { buildPrompts } from '@/lib/prompt-builder';
import { postProcessLatex, validateBraceBalance, validateResumeSubheading } from '@/lib/services/latexProcessor';
import { loadTemplate } from '@/lib/services/templateLoader';
import { callGemini } from '@/lib/services/aiService';

// Allow 120s execution time for this route
export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const input = await req.json();

    const resume = input.resume || '';
    const skills = input.skills || '';
    const jobOffer = input.jobOffer || '';
    const locale = ['fr', 'en'].includes(input.locale) ? input.locale : 'fr';
    // Validate template name against traversal + allowlist
    const templateName = path.basename(String(input.template || 'professional'));
    const allowedTemplates = ['professional', 'charles', 'rezume', 'modern_image', 'one_and_half_column'];
    const finalTemplateName = allowedTemplates.includes(templateName) ? templateName : 'professional';

    const experiences = input.experiences || [];
    const stages = input.stages || [];
    const education = input.education || [];

    const hasStructuredData = experiences.length > 0 || education.length > 0 || stages.length > 0;

    if (!resume && !hasStructuredData) {
      return NextResponse.json({ error: 'Missing required fields: provide resume text or structured experience/education data' }, { status: 400 });
    }
    if (!skills) {
      return NextResponse.json({ error: 'Missing required field: skills' }, { status: 400 });
    }
    if (!jobOffer) {
      return NextResponse.json({ error: 'Missing required field: jobOffer' }, { status: 400 });
    }

    const MAX_RESUME = 15000;
    const MAX_SKILLS = 5000;
    const MAX_JOB = 15000;

    if (resume.length > MAX_RESUME || skills.length > MAX_SKILLS || jobOffer.length > MAX_JOB) {
      return NextResponse.json({ error: `Input too long. Max: resume ${MAX_RESUME}, skills ${MAX_SKILLS}, jobOffer ${MAX_JOB} characters.` }, { status: 400 });
    }

    // Load template file
    let texTemplate = '';
    try {
      texTemplate = await loadTemplate(finalTemplateName);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const [systemPrompt, userPrompt] = buildPrompts(input, texTemplate);

    let responseText = '';
    try {
      responseText = await callGemini({ system: systemPrompt, user: userPrompt });
    } catch (e: any) {
      let errDetails;
      try {
        errDetails = JSON.parse(e.message);
        return NextResponse.json(errDetails, { status: errDetails.httpCode !== 500 ? errDetails.httpCode : 502 });
      } catch {
        return NextResponse.json({ error: 'AI service returned an error', detail: e.message, httpCode: 500 }, { status: 500 });
      }
    }

    let parsed = null;
    let cleanedText = responseText;
    try {
      // Robust JSON extraction
      const match = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (match) {
        cleanedText = match[1];
      } else {
        cleanedText = cleanedText.trim();
        if (cleanedText.startsWith('```json')) {
            cleanedText = cleanedText.replace(/^```json\s*/i, '');
        }
        if (cleanedText.endsWith('```')) {
            cleanedText = cleanedText.replace(/\s*```$/i, '');
        }
      }
      
      parsed = JSON.parse(cleanedText);
    } catch (e: any) {
      console.error('Parse Error - Original Text:', responseText);
      console.error('Parse Error - Cleaned Text:', cleanedText);
      console.error('Parse Error - Exception:', e.message);
      
      // Attempt manual extraction of latexCode as last resort fallback
      const latexMatch = responseText.match(/"latexCode"\s*:\s*"([\s\S]*?)"(?=\s*(?:,|^\}$))/m);
      if (latexMatch) {
         try {
             const manualLatex = JSON.parse(`{"latexCode": "${latexMatch[1]}"}`).latexCode;
             parsed = { latexCode: manualLatex };
         } catch(fallbackErr) {
             return NextResponse.json({ error: 'Failed to parse AI response', detail: e.message }, { status: 500 });     
         }
      } else {
         return NextResponse.json({ error: 'Failed to parse AI response', detail: e.message }, { status: 500 });
      }
    }

    let latexOutput = parsed.latexCode || '';
    if (latexOutput) {
      try {
        // Enforce the original robust preamble from the template, completely bypassing LLM character hallucination
        if (texTemplate.includes('\\begin{document}') && latexOutput.includes('\\begin{document}')) {
          const originalPreamble = texTemplate.split('\\begin{document}')[0];
          const generatedBody = latexOutput.split('\\begin{document}').slice(1).join('\\begin{document}');
          latexOutput = originalPreamble + '\\begin{document}' + generatedBody;
        }

        latexOutput = postProcessLatex(latexOutput, finalTemplateName);
        latexOutput = validateBraceBalance(latexOutput);
        latexOutput = validateResumeSubheading(latexOutput);

        const babelLine = locale === 'fr' ? '\\usepackage[french]{babel}' : '\\usepackage[english]{babel}';
        if (!latexOutput.includes('\\usepackage[french]{babel}') && !latexOutput.includes('\\usepackage[english]{babel}')) {
          latexOutput = latexOutput.replace('\\begin{document}', `${babelLine}\n\\begin{document}`);
        }
        if (latexOutput.includes('french') && !latexOutput.includes('\\shorthandoff{,')) {
          latexOutput = latexOutput.replace('\\begin{document}', '\\AtBeginDocument{\\shorthandoff{,}}\n\\begin{document}');
        }

        if (!latexOutput.trim().endsWith('\\end{document}')) {
          latexOutput = latexOutput.trimEnd() + '\n\\end{document}';
        }
      } catch (e: any) {
        console.error('PostProcess Error:', e);
        return NextResponse.json({ error: e.message, detail: e.stack }, { status: 500 });
      }
    }

    return NextResponse.json({ data: { ...parsed, latexCode: latexOutput } });
  } catch (e: any) {
    console.error('Route Uncaught Error:', e);
    return NextResponse.json({ error: 'Internal Server Error', detail: e.message }, { status: 500 });
  }
}
