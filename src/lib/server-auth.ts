import 'server-only';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export class AuthenticationError extends Error {
  constructor(message: string, public readonly status = 401) {
    super(message);
  }
}

export function getBearerToken(request: Request): string {
  const header = request.headers.get('authorization') || '';
  if (!header.startsWith('Bearer ')) {
    throw new AuthenticationError('Authentication required');
  }

  const token = header.slice(7).trim();
  if (!token) throw new AuthenticationError('Authentication required');
  return token;
}

export async function authenticateRequest(request: Request): Promise<{
  token: string;
  user: AuthenticatedUser;
}> {
  const token = getBearerToken(request);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !anonKey) {
    throw new AuthenticationError('Supabase is not configured', 503);
  }

  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: anonKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new AuthenticationError('Invalid or expired session');
  }

  const user = await response.json() as AuthenticatedUser;
  if (!user.id) throw new AuthenticationError('Invalid user response');
  return { token, user };
}

