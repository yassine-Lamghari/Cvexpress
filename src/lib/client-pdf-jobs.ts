import { LATEX_API_URL } from '@/lib/api-config';

interface GeneratePdfInput {
  token: string;
  latexCode: string;
  template: string;
  filename: string;
  photo?: string;
  cvId?: string;
  onProgress?: (progress: number) => void;
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const data = await response.json().catch(() => null) as { error?: string } | null;
  return new Error(data?.error || `${fallback} (${response.status})`);
}

export async function generateAndDownloadPdf(input: GeneratePdfInput): Promise<void> {
  const createdResponse = await fetch(`${LATEX_API_URL}/latex/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.token}`,
    },
    body: JSON.stringify({
      latexCode: input.latexCode,
      template: input.template,
      filename: input.filename,
      photo: input.photo || '',
      cvId: input.cvId,
    }),
  });

  if (!createdResponse.ok) {
    throw await responseError(createdResponse, 'Unable to create PDF job');
  }

  const created = await createdResponse.json() as { statusUrl: string };
  let downloadUrl = '';

  for (let attempt = 0; attempt < 180; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    const statusResponse = await fetch(created.statusUrl, {
      headers: { Authorization: `Bearer ${input.token}` },
      cache: 'no-store',
    });
    if (!statusResponse.ok) {
      throw await responseError(statusResponse, 'Unable to read PDF job');
    }

    const job = await statusResponse.json() as {
      status: 'queued' | 'processing' | 'completed' | 'failed';
      progress?: number;
      downloadUrl?: string;
      error?: string;
    };
    input.onProgress?.(job.progress || 0);

    if (job.status === 'failed') {
      throw new Error(job.error || 'PDF generation failed');
    }
    if (job.status === 'completed' && job.downloadUrl) {
      downloadUrl = job.downloadUrl;
      break;
    }
  }

  if (!downloadUrl) throw new Error('PDF generation timed out');

  const downloadResponse = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${input.token}` },
  });
  if (!downloadResponse.ok) {
    throw await responseError(downloadResponse, 'Unable to download PDF');
  }

  const blob = await downloadResponse.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = input.filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

