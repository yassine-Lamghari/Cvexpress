import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { buildPrompts } from '@/lib/prompt-builder';
import { postProcessLatex, validateBraceBalance, validateResumeSubheading } from '@/lib/latex-postprocessor';

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

    // Load template file (path changed since PHP backend removal)
    const texPath = path.join(process.cwd(), 'src', 'app', 'api', 'templates', `${finalTemplateName}.tex`);
    let texTemplate = '';
    try {
      texTemplate = await fs.readFile(texPath, 'utf-8');
    } catch (e) {
      // Fallback relative to src/templates for Next.js folder structure if moved
      try {
        const altTexPath = path.join(process.cwd(), 'src', 'templates', `${finalTemplateName}.tex`);
        texTemplate = await fs.readFile(altTexPath, 'utf-8');
      } catch(e2) {
        // Fallback relative to public
        try {
          const publicTexPath = path.join(process.cwd(), 'public', 'templates', `${finalTemplateName}.tex`);
          texTemplate = await fs.readFile(publicTexPath, 'utf-8');
        } catch (e3) {
            return NextResponse.json({ error: 'Template file not found: ' + finalTemplateName + ' checked multiple paths.' }, { status: 400 });
        }
      }
    }

    const [systemPrompt, userPrompt] = buildPrompts(input, texTemplate);

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
    }

    const geminiModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
    let responseText = '{}';
    let apiErrorDetail = '';
    let success = false;
    let statusCode = 500;

    for (const model of geminiModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 32768,
          responseMimeType: 'application/json'
        }
      };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          // We can't really pass timeout in standard fetch easily inside Next.js core without AbortController,
          // but Vercel manages the duration.
        });

        if (res.ok) {
          const data = await res.json();
          responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          success = true;
          break;
        } else {
          statusCode = res.status;
          const errBody = await res.json().catch(() => ({}));
          apiErrorDetail = errBody.error?.message || `HTTP ${res.status}`;
          if (res.status !== 429) {
            break; // Break if not rate limited
          }
        }
      } catch (e: any) {
        apiErrorDetail = e.message;
        break;
      }
    }

    if (!success) {
      return NextResponse.json({ error: 'AI service returned an error', detail: apiErrorDetail, httpCode: statusCode }, { status: statusCode !== 500 ? statusCode : 502 });
    }

    let parsed = null;
    try {
      let cleanedText = responseText.replace(/^```json\\s*/i, '').replace(/```\\s*$/i, '');
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    let latexOutput = parsed.latexCode || '';
    if (latexOutput) {
      try {
        latexOutput = postProcessLatex(latexOutput, finalTemplateName);
        latexOutput = validateBraceBalance(latexOutput);
        latexOutput = validateResumeSubheading(latexOutput);

        const babelLine = locale === 'fr' ? '\\usepackage[french]{babel}' : '\\usepackage[english]{babel}';
        if (!latexOutput.includes('\\usepackage[french]{babel}') && !latexOutput.includes('\\usepackage[english]{babel}')) {
          latexOutput = latexOutput.replace('\\begin{document}', `${babelLine}\n\\begin{document}`);
        }

        if (!latexOutput.trim().endsWith('\\end{document}')) {
          latexOutput = latexOutput.trimEnd() + '\n\\end{document}';
        }
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        latexCode: latexOutput,
        motivationLetter: parsed.motivationLetter || '',
        candidacyEmail: parsed.candidacyEmail || ''
      },
      remaining: 100 // Mock or implement if you port rate limiting
    });

  } catch (error: any) {
    console.error('Generation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: error.stack }, { status: 500 });
  }
}
