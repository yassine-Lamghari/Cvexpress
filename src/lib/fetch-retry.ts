export async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      const res = await fetch(url, options);
      if (res.status === 403 && attempt < maxRetries - 1) {
        const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
        if (rateLimitRemaining === '0') {
           const retryAfter = res.headers.get('Retry-After');
           const delay = retryAfter ? parseInt(retryAfter) * 1000 : Math.pow(2, attempt) * 1000;
           await new Promise(resolve => setTimeout(resolve, delay));
           attempt++;
           continue;
        }
      }
      return res;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
    }
    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    attempt++;
  }
  throw new Error('Max retries reached');
}
