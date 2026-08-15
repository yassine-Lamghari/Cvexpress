import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthenticationError, authenticateRequest } from '@/lib/server-auth';
import { enqueuePdfTask } from '@/lib/pdf-task-client';
import { createStorageJobRecord, deleteStorageJobRecord } from '@/lib/storage-records';

const requestSchema = z.object({
  latexCode: z.string().min(20).max(1_000_000),
  photo: z.string().max(12_000_000).optional().default(''),
  template: z.enum(['professional', 'charles', 'rezume', 'modern_image', 'one_and_half_column']),
  filename: z.string().min(1).max(180),
  cvId: z.string().uuid().optional(),
});

function sanitizePdfFilename(value: string): string {
  const base = value.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 160);
  return `${base || 'CV'}.pdf`;
}

export async function POST(request: Request) {
  let jobId: string | null = null;
  let token: string | null = null;
  let recordCreated = false;
  try {
    const auth = await authenticateRequest(request);
    token = auth.token;
    const { user } = auth;
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid PDF job payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    jobId = crypto.randomUUID();
    const filename = sanitizePdfFilename(parsed.data.filename);

    await createStorageJobRecord({
      token,
      userId: user.id,
      jobId,
      cvId: parsed.data.cvId,
      filename,
    });
    recordCreated = true;

    await enqueuePdfTask({
      jobId,
      data: {
        userId: user.id,
        cvId: parsed.data.cvId,
        latexCode: parsed.data.latexCode,
        photo: parsed.data.photo,
        template: parsed.data.template,
        filename,
      },
    });

    return NextResponse.json({
      jobId,
      status: 'queued',
      statusUrl: `/api/latex/jobs/${jobId}`,
    }, { status: 202 });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (recordCreated && token && jobId) {
      await deleteStorageJobRecord(token, jobId).catch((cleanupError) => {
        console.error('Unable to remove orphaned storage job record:', cleanupError);
      });
    }
    console.error('Failed to enqueue PDF job:', { jobId, error });
    return NextResponse.json({
      error: 'Unable to enqueue PDF generation. Verify Celery, Redis and the storage_objects migration.',
    }, { status: 503 });
  }
}
