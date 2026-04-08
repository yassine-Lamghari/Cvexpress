'use client';

import { useMemo, useState } from 'react';
import { X, Loader2, Send } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { extractFirstEmailFromText } from '@/lib/email-utils';

interface SendApplicationModalProps {
  open: boolean;
  loading: boolean;
  jobOffer: string;
  defaultBody: string;
  defaultSubject: string;
  onClose: () => void;
  onSubmit: (payload: {
    recipientEmails: string[];
    recipientName?: string;
    companyName?: string;
    subject: string;
    emailBody: string;
    includeCvPdf: boolean;
    includeLetterPdf: boolean;
  }) => Promise<void>;
}

export default function SendApplicationModal({
  open,
  loading,
  jobOffer,
  defaultBody,
  defaultSubject,
  onClose,
  onSubmit,
}: SendApplicationModalProps) {
  const { t } = useTranslations();
  const detectedEmail = useMemo(() => extractFirstEmailFromText(jobOffer || ''), [jobOffer]);

  const [recipientEmailsText, setRecipientEmailsText] = useState(detectedEmail || '');
  const [recipientName, setRecipientName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [subject, setSubject] = useState(defaultSubject);
  const [emailBody, setEmailBody] = useState(defaultBody);
  const [includeCvPdf, setIncludeCvPdf] = useState(true);
  const [includeLetterPdf, setIncludeLetterPdf] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientEmailsText.trim()) {
      setError(t('results.sendRecipientRequired') || 'Email requis');
      return;
    }

    const emails = recipientEmailsText
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e !== '');

    if (emails.length === 0) {
      setError(t('results.sendRecipientRequired') || 'Email requis');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));
    
    if (invalidEmails.length > 0) {
      setError(`Emails invalides: ${invalidEmails.join(', ')}`);
      return;
    }

    setError(null);

    await onSubmit({
      recipientEmails: emails,
      recipientName: recipientName.trim() || undefined,
      companyName: companyName.trim() || undefined,
      subject: subject.trim(),
      emailBody,
      includeCvPdf,
      includeLetterPdf,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 p-6 relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600" disabled={loading}>
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-semibold text-gray-900 mb-1">{t('results.sendApplication')}</h3>
        <p className="text-sm text-gray-500 mb-4">{t('results.sendApplicationHint') || 'Vous pouvez séparer plusieurs adresses email par des virgules (,)'}</p>

        {detectedEmail && (
          <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2 mb-4">
            {t('results.detectedEmail')}: {detectedEmail}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-sm text-red-600 bg-red-50 p-2 rounded">{error}</p>}
          <input
            type="text"
            required
            value={recipientEmailsText}
            onChange={(e) => setRecipientEmailsText(e.target.value)}
            placeholder={t('results.recipientEmail') || 'email1@test.com, email2@test.com'}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder={t('results.recipientName')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder={t('results.companyName')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
            />
          </div>

          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t('results.emailSubject')}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400"
          />

          <textarea
            value={emailBody}
            onChange={(e) => setEmailBody(e.target.value)}
            rows={9}
            className="w-full text-sm text-gray-700 leading-relaxed font-mono bg-gray-50 border border-gray-200 rounded-md p-3 focus:outline-none focus:ring-1 focus:ring-gray-400 resize-y"
          />

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={includeCvPdf}
                onChange={(e) => setIncludeCvPdf(e.target.checked)}
                className="rounded"
              />
              {t('results.attachCvPdf')}
            </label>

            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                checked={includeLetterPdf}
                onChange={(e) => setIncludeLetterPdf(e.target.checked)}
                className="rounded"
              />
              {t('results.attachLetterPdf')}
            </label>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? t('results.sending') : t('results.sendNow')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
