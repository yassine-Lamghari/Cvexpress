import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRateLimiter } from '@/lib/rate-limit';

export async function middleware(request: NextRequest) {
  // CORS check (CSRF Protection for API routes)
  const origin = request.headers.get('origin');
  
  // Basic security headers
  const response = NextResponse.next();
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  if (origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
  }
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { headers: response.headers });
  }

  // Rate Limiting on API generation endpoints
  const rateLimiter = getRateLimiter();
  if (
    rateLimiter &&
    (request.nextUrl.pathname.startsWith('/api/generate') ||
     request.nextUrl.pathname.startsWith('/api/edit') ||
      request.nextUrl.pathname.startsWith('/api/latex/preview') ||
      request.nextUrl.pathname.startsWith('/api/applications/send'))
  ) {
    try {
      const ip = (request as any).ip ?? request.headers.get('x-forwarded-for') ?? '127.0.0.1';
      const { success, limit, reset, remaining } = await rateLimiter.limit(`ratelimit_${ip}`);
      
      response.headers.set('X-RateLimit-Limit', limit.toString());
      response.headers.set('X-RateLimit-Remaining', remaining.toString());
      response.headers.set('X-RateLimit-Reset', reset.toString());

      if (!success) {
        return new NextResponse(
          JSON.stringify({ error: 'Trop de requêtes. Veuillez patienter un instant.' }),
          { status: 429, headers: response.headers }
        );
      }
    } catch (error) {
      console.error('Rate Limiter Error (falling back to allow):', error);
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
