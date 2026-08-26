import { NextResponse } from 'next/server';
import { getAiTaskStatus } from '@/lib/ai-task-client';
import { verifyAiJobToken } from '@/lib/ai-job-token';
import { processAiGenerationResult } from '@/lib/services/aiResultProcessor';
import { loadTemplate } from '@/lib/services/templateLoader';
import { isValidTemplateId } from '@/templates/config';

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(request: Request, context: RouteContext) {
  const { jobId } = await context.params;
  const token = new URL(request.url).searchParams.get('token') || '';
  if (!verifyAiJobToken(jobId, token)) {
    return NextResponse.json({ error: 'Invalid AI job token' }, { status: 403 });
  }

  try {
    const task = await getAiTaskStatus(jobId);
    if (task.state === 'SUCCESS' && task.result) {
      try {
        if (!isValidTemplateId(task.result.template)) {
          throw new Error('AI task returned an invalid template');
        }
        const texTemplate = await loadTemplate(task.result.template);
        const data = processAiGenerationResult(
          task.result.responseText,
          texTemplate,
          task.result.template,
          task.result.locale,
        );
        return NextResponse.json({ jobId, status: 'completed', progress: 100, data });
      } catch (error) {
        const detail = error instanceof Error ? error.message : 'Invalid AI result';
        return NextResponse.json({
          jobId,
          status: 'failed',
          progress: 100,
          error: `AI result validation failed: ${detail}`,
        });
      }
    }
    if (task.state === 'FAILURE') {
      return NextResponse.json({
        jobId,
        status: 'failed',
        progress: 100,
        error: task.error || 'AI generation failed',
      });
    }

    const status = task.state === 'PENDING' ? 'queued' : 'processing';
    return NextResponse.json({ jobId, status, progress: task.progress || 0 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Unknown AI job error';
    return NextResponse.json({ error: 'Unable to read AI generation job', detail }, { status: 502 });
  }
}
