import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';

// Server/worker module. Never import this file from a client component because
// it reads private MinIO credentials.

interface ObjectStorageConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  useSsl: boolean;
}

let client: S3Client | null = null;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing object storage variable: ${name}`);
  return value;
}

export function getObjectStorageConfig(): ObjectStorageConfig {
  return {
    endpoint: requiredEnv('MINIO_ENDPOINT'),
    region: process.env.MINIO_REGION?.trim() || 'us-east-1',
    bucket: requiredEnv('MINIO_BUCKET'),
    accessKey: requiredEnv('MINIO_ACCESS_KEY'),
    secretKey: requiredEnv('MINIO_SECRET_KEY'),
    useSsl: process.env.MINIO_USE_SSL === 'true',
  };
}

function getClient(): S3Client {
  if (client) return client;

  const config = getObjectStorageConfig();
  const endpoint = new URL(config.endpoint);
  endpoint.protocol = config.useSsl ? 'https:' : 'http:';

  client = new S3Client({
    endpoint: endpoint.toString(),
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKey,
      secretAccessKey: config.secretKey,
    },
  });

  return client;
}

export function buildUserObjectKey(
  userId: string,
  category: 'photos' | 'pdfs' | 'exports' | 'raw',
  fileName: string,
): string {
  const safeUserId = userId.replace(/[^a-zA-Z0-9-]/g, '');
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');

  if (!safeUserId || !safeFileName) {
    throw new Error('Invalid object key');
  }

  return `users/${safeUserId}/${category}/${safeFileName}`;
}

export async function checkObjectStorage(): Promise<void> {
  const config = getObjectStorageConfig();
  await getClient().send(new HeadBucketCommand({ Bucket: config.bucket }));
}

export async function uploadObject(
  key: string,
  body: NonNullable<PutObjectCommandInput['Body']>,
  contentType: string,
): Promise<void> {
  const config = getObjectStorageConfig();
  await getClient().send(new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}

export async function downloadObject(key: string) {
  const config = getObjectStorageConfig();
  return getClient().send(new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}

export async function deleteObject(key: string): Promise<void> {
  const config = getObjectStorageConfig();
  await getClient().send(new DeleteObjectCommand({
    Bucket: config.bucket,
    Key: key,
  }));
}
