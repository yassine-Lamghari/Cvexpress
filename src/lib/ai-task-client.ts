export interface AiTaskInput {
  jobId: string;
  systemPrompt: string;
  userPrompt: string;
  template: string;
  locale: 'fr' | 'en';
}

export interface AiTaskStatus {
  state: string;
  progress?: number;
  result?: {
    responseText: string;
    template: string;
    locale: 'fr' | 'en';
  };
  error?: string;
}

function taskApiConfig() {
  const baseUrl = process.env.PDF_TASK_API_URL?.trim();
  const secret = process.env.TASK_API_SECRET?.trim();
  if (!baseUrl || !secret) {
    throw new Error('Missing PDF_TASK_API_URL or TASK_API_SECRET');
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), secret };
}

async function taskApiFetch(path: string, init?: RequestInit): Promise<Response> {
  const { baseUrl, secret } = taskApiConfig();
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...init?.headers,
      'X-Internal-Secret': secret,
    },
    cache: 'no-store',
  });
}

export async function enqueueAiTask(input: AiTaskInput): Promise<void> {
  const response = await taskApiFetch('/ai-jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Celery task API rejected the AI job (${response.status}): ${detail.slice(0, 300)}`);
  }
}

export async function getAiTaskStatus(jobId: string): Promise<AiTaskStatus> {
  const response = await taskApiFetch(`/jobs/${encodeURIComponent(jobId)}`);
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Unable to read Celery AI job (${response.status}): ${detail.slice(0, 300)}`);
  }
  return response.json() as Promise<AiTaskStatus>;
}
