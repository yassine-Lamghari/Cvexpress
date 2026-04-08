import type Mail from 'nodemailer/lib/mailer';
import { getSmtpConfig, getSmtpTransporter } from '@/lib/smtp-config';

export interface SendApplicationEmailParams {
  to: string;
  subject: string;
  body: string;
  recipientName?: string;
  companyName?: string;
  candidateFullName: string;
  candidateEmail: string;
  attachments?: Mail.Attachment[];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatBodyAsHtml(body: string): string {
  const escaped = escapeHtml(body);
  return escaped.replace(/\n/g, '<br/>');
}

export async function sendApplicationEmail(params: SendApplicationEmailParams): Promise<string> {
  const config = getSmtpConfig();
  const transporter = getSmtpTransporter();

  const htmlBody = formatBodyAsHtml(params.body);
  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#111;">
      <p>${params.recipientName ? `Dear ${escapeHtml(params.recipientName)},` : 'Hello,'}</p>
      <p>${htmlBody}</p>
      <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
      <p style="margin:0;"><strong>${escapeHtml(params.candidateFullName)}</strong></p>
      <p style="margin:0;"><a href="mailto:${escapeHtml(params.candidateEmail)}">${escapeHtml(params.candidateEmail)}</a></p>
      ${params.companyName ? `<p style="margin-top:12px;color:#666;">Application sent to ${escapeHtml(params.companyName)}</p>` : ''}
    </div>
  `;

  let info: Awaited<ReturnType<typeof transporter.sendMail>>;
  try {
    info = await transporter.sendMail({
      from: `"${config.fromName}" <${config.fromEmail}>`,
      to: params.to,
      subject: params.subject,
      text: params.body,
      html,
      attachments: params.attachments,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'SMTP send failed';
    if (message.includes('535-5.7.8') || message.includes('Username and Password not accepted')) {
      throw new Error('SMTP authentication failed (Gmail 535). Verify 2-Step Verification is enabled, generate a fresh App Password, and set SMTP_PASS without spaces.');
    }
    throw error;
  }

  return info.messageId;
}
