import { NextResponse } from 'next/server';
import { compileLatex, cleanupTmpDir } from '@/lib/latex-compiler';
import { promises as fs } from 'fs';

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.substring(7).trim();
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
    }

    // Verify token with Supabase
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
      }
    });

    if (!userRes.ok) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const input = await req.json();
    const template = input.template || 'professional';
    const latexCode = input.latexCode || '';
    const photo = input.photo || '';
    const rawFilename = input.filename || 'CV.pdf';
    // Sanitization against injection: only alphanumeric characters, dashes, and underscores allowed + .pdf
    const sanitizedName = rawFilename.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = sanitizedName.endsWith('_pdf') ? sanitizedName.slice(0, -4) + '.pdf' : sanitizedName + '.pdf';

    const allowedTemplates = ['professional', 'charles', 'rezume', 'modern_image', 'one_and_half_column'];
    if (!allowedTemplates.includes(template)) {
      return NextResponse.json({ error: 'Unknown template: ' + template }, { status: 400 });
    }

    if (!latexCode) {
      return NextResponse.json({ error: 'Missing latexCode' }, { status: 400 });
    }

    let result;
    try {
      result = await compileLatex(latexCode, photo);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }

    const { pdfPath, tmpDir } = result;

    try {
      const pdfBuffer = await fs.readFile(pdfPath);
      await cleanupTmpDir(tmpDir);

      return new NextResponse(pdfBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        }
      });
    } catch (e: any) {
      await cleanupTmpDir(tmpDir);
      return NextResponse.json({ error: 'Failed to read PDF file' }, { status: 500 });
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
