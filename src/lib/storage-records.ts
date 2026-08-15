import type { PdfJobResult, PdfJobStatus } from '@/types/pdf-job';

export interface StorageJobRecord {
  job_id: string;
  user_id: string;
  status: PdfJobStatus;
  progress: number;
  object_key: string | null;
  filename: string;
  content_type: string;
  size_bytes: number | null;
  error_message: string | null;
}

function supabaseRestUrl(): string {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  return `${value}/rest/v1/storage_objects`;
}

async function requireSuccess(response: Response, operation: string): Promise<void> {
  if (response.ok) return;
  const detail = await response.text().catch(() => '');
  throw new Error(`${operation} failed (${response.status}): ${detail.slice(0, 300)}`);
}

export async function createStorageJobRecord(input: {
  token: string;
  userId: string;
  jobId: string;
  cvId?: string;
  filename: string;
}): Promise<void> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const response = await fetch(supabaseRestUrl(), {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${input.token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      job_id: input.jobId,
      user_id: input.userId,
      cv_id: input.cvId || null,
      filename: input.filename,
      bucket: process.env.MINIO_BUCKET || 'cvzzer-datalake',
      content_type: 'application/pdf',
      status: 'queued',
    }),
  });

  await requireSuccess(response, 'Creating storage job record');
}

export async function deleteStorageJobRecord(token: string, jobId: string): Promise<void> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const response = await fetch(`${supabaseRestUrl()}?job_id=eq.${encodeURIComponent(jobId)}`, {
    method: 'DELETE',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=minimal',
    },
  });
  await requireSuccess(response, 'Deleting orphaned storage job record');
}

export async function getStorageJobRecord(
  token: string,
  jobId: string,
): Promise<StorageJobRecord | null> {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!anonKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const fields = 'job_id,user_id,status,progress,object_key,filename,content_type,size_bytes,error_message';
  const response = await fetch(
    `${supabaseRestUrl()}?job_id=eq.${encodeURIComponent(jobId)}&select=${fields}`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      cache: 'no-store',
    },
  );
  await requireSuccess(response, 'Reading storage job record');
  const rows = await response.json() as StorageJobRecord[];
  return rows[0] || null;
}

async function updateStorageJobRecord(
  jobId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceRoleKey) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');

  const response = await fetch(`${supabaseRestUrl()}?job_id=eq.${encodeURIComponent(jobId)}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(values),
  });

  await requireSuccess(response, 'Updating storage job record');
}

export async function completeStorageJobRecord(jobId: string, result: PdfJobResult): Promise<void> {
  await updateStorageJobRecord(jobId, {
    status: 'completed',
    progress: 100,
    object_key: result.objectKey,
    size_bytes: result.sizeBytes,
    checksum_sha256: result.checksumSha256,
    completed_at: new Date().toISOString(),
    error_message: null,
  });
}

export async function failStorageJobRecord(jobId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : 'Unknown worker error';
  await updateStorageJobRecord(jobId, {
    status: 'failed',
    error_message: message.slice(0, 1_000),
  });
}
