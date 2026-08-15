import type { PdfJobData } from '@/types/pdf-job';

interface EnqueuePdfTaskInput {
  jobId: string;
  data: PdfJobData;
}

function taskApiConfig() {
  const baseUrl = process.env.PDF_TASK_API_URL?.trim();
  const secret = process.env.TASK_API_SECRET?.trim();

  if (!baseUrl || !secret) {
    throw new Error('Missing PDF_TASK_API_URL or TASK_API_SECRET');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), secret };
}

export async function enqueuePdfTask(input: EnqueuePdfTaskInput): Promise<void> {
  const { baseUrl, secret } = taskApiConfig();
  const response = await fetch(`${baseUrl}/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Secret': secret,
    },
    body: JSON.stringify({
      jobId: input.jobId,
      ...input.data,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Celery task API rejected the job (${response.status}): ${detail.slice(0, 300)}`);
  }
}

