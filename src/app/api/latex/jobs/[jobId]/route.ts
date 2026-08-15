import { NextResponse } from 'next/server';
import { AuthenticationError, authenticateRequest } from '@/lib/server-auth';
import { getStorageJobRecord } from '@/lib/storage-records';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  try {
    const { token } = await authenticateRequest(request);
    const { jobId } = await context.params;
    const job = await getStorageJobRecord(token, jobId);

    if (!job) {
      return NextResponse.json({ error: 'PDF job not found' }, { status: 404 });
    }

    return NextResponse.json({
      jobId,
      status: job.status,
      progress: job.progress,
      error: job.status === 'failed' ? (job.error_message || 'PDF generation failed.') : undefined,
      downloadUrl: job.status === 'completed' ? `/api/latex/jobs/${jobId}/download` : undefined,
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to read PDF job:', error);
    return NextResponse.json({ error: 'Unable to read PDF job' }, { status: 503 });
  }
}
