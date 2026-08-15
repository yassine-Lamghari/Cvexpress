import { NextResponse } from 'next/server';
import { checkObjectStorage, getObjectStorageConfig } from '@/lib/object-storage';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await checkObjectStorage();
    const { bucket } = getObjectStorageConfig();

    return NextResponse.json({
      status: 'ok',
      service: 'object-storage',
      bucket,
    });
  } catch (error) {
    console.error('Object storage health check failed:', error);
    return NextResponse.json(
      { status: 'unavailable', service: 'object-storage' },
      { status: 503 },
    );
  }
}

