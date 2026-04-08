import nodemailer from 'nodemailer';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromEmail: string;
  fromName: string;
}

let cachedTransporter: nodemailer.Transporter | null = null;

export function getSmtpConfig(): SmtpConfig {
  const host = (process.env.SMTP_HOST || '').trim();
  const portRaw = process.env.SMTP_PORT || '';
  const user = (process.env.SMTP_USER || '').trim();
  // Gmail app passwords are often shown in groups (e.g. "abcd efgh ijkl mnop").
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
  const fromEmail = (process.env.SMTP_FROM_EMAIL || '').trim();
  const fromName = (process.env.SMTP_FROM_NAME || 'CVzzer').trim();

  const port = Number(portRaw);

  if (!host || !port || !user || !pass || !fromEmail) {
    throw new Error('SMTP is not configured correctly');
  }

  return { host, port, user, pass, fromEmail, fromName };
}

export function getSmtpTransporter(): nodemailer.Transporter {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const config = getSmtpConfig();

  cachedTransporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransporter;
}
