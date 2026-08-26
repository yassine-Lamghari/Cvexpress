import crypto from 'crypto';
import { NextResponse } from 'next/server';
import path from 'path';
import { buildPrompts } from '@/lib/prompt-builder';
import { enqueueAiTask } from '@/lib/ai-task-client';
import { createAiJobToken } from '@/lib/ai-job-token';
import { loadTemplate } from '@/lib/services/templateLoader';
import { ALLOWED_TEMPLATES, isValidTemplateId } from '@/templates/config';

export const maxDuration = 30;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

export async function POST(req: Request) {
  try {
    const input = await req.json();
    const resume = input.resume || '';
    const skills = input.skills || '';
    const jobOffer = input.jobOffer || '';
    const locale = ['fr', 'en'].includes(input.locale) ? input.locale : 'fr';
    const templateName = path.basename(String(input.template || ALLOWED_TEMPLATES[0]));
    const finalTemplateName = isValidTemplateId(templateName) ? templateName : ALLOWED_TEMPLATES[0];
    const experiences = input.experiences || [];
    const stages = input.stages || [];
    const education = input.education || [];
    const hasStructuredData = experiences.length > 0 || education.length > 0 || stages.length > 0;

    if (!resume && !hasStructuredData) {
      return NextResponse.json({
        error: 'Missing required fields: provide resume text or structured experience/education data',
      }, { status: 400 });
    }
    if (!skills) {
      return NextResponse.json({ error: 'Missing required field: skills' }, { status: 400 });
    }
    if (!jobOffer) {
      return NextResponse.json({ error: 'Missing required field: jobOffer' }, { status: 400 });
    }

    const MAX_RESUME = 15_000;
    const MAX_SKILLS = 5_000;
    const MAX_JOB = 15_000;
    if (resume.length > MAX_RESUME || skills.length > MAX_SKILLS || jobOffer.length > MAX_JOB) {
      return NextResponse.json({
        error: `Input too long. Max: resume ${MAX_RESUME}, skills ${MAX_SKILLS}, jobOffer ${MAX_JOB} characters.`,
      }, { status: 400 });
    }

    let texTemplate: string;
    try {
      texTemplate = await loadTemplate(finalTemplateName);
    } catch (error) {
      return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
    }

    const [systemPrompt, userPrompt] = buildPrompts({ ...input, locale }, texTemplate);
    const jobId = crypto.randomUUID();
    const token = createAiJobToken(jobId);

    await enqueueAiTask({
      jobId,
      systemPrompt,
      userPrompt,
      template: finalTemplateName,
      locale,
    });

    return NextResponse.json({
      jobId,
      status: 'queued',
      statusUrl: `/api/generate/${jobId}?token=${encodeURIComponent(token)}`,
    }, { status: 202 });
  } catch (error) {
    console.error('Unable to enqueue AI generation:', error);
    return NextResponse.json({
      error: 'Unable to enqueue AI generation',
      detail: errorMessage(error),
    }, { status: 503 });
  }
}
