import crypto from 'crypto';

function tokenSecret(): string {
  const secret = process.env.TASK_API_SECRET?.trim();
  if (!secret) {
    throw new Error('TASK_API_SECRET is not configured');
  }
  return secret;
}

export function createAiJobToken(jobId: string): string {
  return crypto.createHmac('sha256', tokenSecret()).update(jobId).digest('hex');
}

export function verifyAiJobToken(jobId: string, token: string): boolean {
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return false;
  }
  const expected = Buffer.from(createAiJobToken(jobId), 'hex');
  const received = Buffer.from(token, 'hex');
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}
