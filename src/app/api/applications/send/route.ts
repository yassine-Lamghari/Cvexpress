import { NextResponse } from 'next/server';
import type Mail from 'nodemailer/lib/mailer';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { promises as fs } from 'fs';
import { compileLatex, cleanupTmpDir } from '@/lib/latex-compiler';
import { getSmtpConfig } from '@/lib/smtp-config';
import { sendApplicationSchema } from '@/lib/zod-schemas';
import { sendApplicationEmail } from '@/lib/services/emailService';

function buildSubject(value: string): string {
  return value.replace(/[\r\n]/g, ' ').trim();
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_');
}

async function buildMotivationLetterPdf(content: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 11;
  const margin = 48;
  const lineHeight = 16;
  const maxWidth = page.getWidth() - margin * 2;

  const words = content.replace(/\r/g, '').split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const next = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(next, fontSize);
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = next;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  let cursorY = page.getHeight() - margin;
  page.drawText('Motivation Letter', {
    x: margin,
    y: cursorY,
    size: 14,
    font,
    color: rgb(0.1, 0.1, 0.1),
  });
  cursorY -= lineHeight * 2;

  for (const line of lines) {
    if (cursorY < margin) {
      cursorY = page.getHeight() - margin;
      pdfDoc.addPage([595, 842]);
    }
    const targetPage = pdfDoc.getPages()[pdfDoc.getPages().length - 1];
    targetPage.drawText(line, {
      x: margin,
      y: cursorY,
      size: fontSize,
      font,
      color: rgb(0.08, 0.08, 0.08),
    });
    cursorY -= lineHeight;
  }

  return pdfDoc.save();
}

async function verifyUserFromBearer(authHeader: string): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  if (!authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Authentication required' };
  }

  const token = authHeader.substring(7).trim();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false, status: 500, error: 'Supabase not configured' };
  }

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: supabaseAnonKey,
    },
  });

  if (!userRes.ok) {
    return { ok: false, status: 401, error: 'Invalid or expired session' };
  }

  const userData = await userRes.json();
  const email = String(userData?.email || '').trim().toLowerCase();
  if (!email) {
    return { ok: false, status: 401, error: 'Invalid user profile' };
  }

  return { ok: true, email };
}

export async function POST(req: Request) {
  let tmpDir: string | null = null;
  const warnings: string[] = [];

  try {
    const authHeader = req.headers.get('authorization') || '';
    const auth = await verifyUserFromBearer(authHeader);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    try {
      getSmtpConfig();
    } catch {
      return NextResponse.json(
        { error: 'SMTP not configured', detail: 'Please set SMTP_* variables in .env.local and restart the server.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const parsed = sendApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const payload = parsed.data;

    const authenticatedCandidateEmail = auth.email;

    const attachments: Mail.Attachment[] = [];

    let pdfsCreated = false;

    if (payload.includeCvPdf) {
      try {
        const compiled = await compileLatex(payload.latexCode, payload.photo || '');
        tmpDir = compiled.tmpDir;
        const cvBuffer = await fs.readFile(compiled.pdfPath);
        attachments.push({
          filename: `${sanitizeFileName(payload.candidateFullName)}_CV.pdf`,
          content: cvBuffer,
          contentType: 'application/pdf',
        });
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : 'unknown error';
        warnings.push(`CV attachment failed: ${detail}`);
      }
    }

    if (payload.includeLetterPdf) {
      try {
        const letterPdf = await buildMotivationLetterPdf(payload.motivationLetter);
        attachments.push({
          filename: `${sanitizeFileName(payload.candidateFullName)}_Letter.pdf`,
          content: Buffer.from(letterPdf),
          contentType: 'application/pdf',
        });
      } catch (error: unknown) {
        const detail = error instanceof Error ? error.message : 'unknown error';
        warnings.push(`Letter attachment failed: ${detail}`);
      }
    }

    const messageIds = [];
    const DELAY_BETWEEN_EMAILS_MS = 6000;

    for (let i = 0; i < payload.recipientEmails.length; i++) {
      const recipientEmail = payload.recipientEmails[i];

      try {
        const messageId = await sendApplicationEmail({
          to: recipientEmail,
          subject: buildSubject(payload.subject),
          body: payload.emailBody,
          recipientName: payload.recipientName,
          companyName: payload.companyName,
          candidateEmail: authenticatedCandidateEmail,
          candidateFullName: payload.candidateFullName,
          attachments,
        });

        messageIds.push({ email: recipientEmail, success: true, messageId });
      } catch (err: unknown) {
        console.error(`Failed to send email to ${recipientEmail}:`, err);
        messageIds.push({ email: recipientEmail, success: false, error: err instanceof Error ? err.message : String(err) });
      }

      // Add delay between sends, unless it's the last email
      if (i < payload.recipientEmails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_EMAILS_MS));
      }
    }

    return NextResponse.json({ success: true, messageIds, warnings });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : 'Unexpected error';
    console.error('Application send failed:', detail);
    if (detail.includes('SMTP authentication failed')) {
      return NextResponse.json(
        { error: 'SMTP authentication failed', detail },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to send application', detail },
      { status: 502 }
    );
  } finally {
    if (tmpDir) {
      await cleanupTmpDir(tmpDir).catch(() => {});
    }
  }
}
