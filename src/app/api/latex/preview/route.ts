import { NextResponse } from 'next/server';
import { compileLatex, generatePreview, cleanupTmpDir } from '@/lib/latex-compiler';

export async function POST(req: Request) {
  try {
    // Note: We remvoved the strict Supabase auth here so guests can see their CV preview.
    // Rate Limiting (Upstash) in middleware.ts is handling the abuse protection.
    
    const input = await req.json();
    const template = input.template || 'professional';
    const latexCode = input.latexCode || '';
    const photo = input.photo || '';

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
      const previewDataUrl = await generatePreview(pdfPath, tmpDir);
      return NextResponse.json({
        success: true,
        preview: previewDataUrl,
        format: previewDataUrl.includes('image/png') ? 'png' : 'pdf'
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    } finally {
      await cleanupTmpDir(tmpDir);
    }

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
