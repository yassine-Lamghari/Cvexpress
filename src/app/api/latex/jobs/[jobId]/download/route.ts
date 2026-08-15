import { NextResponse } from 'next/server';
import { AuthenticationError, authenticateRequest } from '@/lib/server-auth';
import { getStorageJobRecord } from '@/lib/storage-records';
import { downloadObject } from '@/lib/object-storage';

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

    if (job.status !== 'completed' || !job.object_key) {
      return NextResponse.json({ error: 'PDF is not ready' }, { status: 409 });
    }

    const object = await downloadObject(job.object_key);
    if (!object.Body) {
      return NextResponse.json({ error: 'Stored PDF is empty' }, { status: 500 });
    }

    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': job.content_type,
        ...(job.size_bytes ? { 'Content-Length': String(job.size_bytes) } : {}),
        'Content-Disposition': `attachment; filename="${job.filename}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Failed to download stored PDF:', error);
    return NextResponse.json({ error: 'Unable to download stored PDF' }, { status: 503 });
  }
}
