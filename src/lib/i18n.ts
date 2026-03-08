'use client';

import { useCallback } from 'react';
import { useCVStore } from '@/stores/cv-store';
import type { Locale } from '@/types/cv';
import fr from '@/messages/fr.json';
import en from '@/messages/en.json';

const messages: Record<Locale, typeof fr> = { fr, en };

export function useTranslations() {
  const locale = useCVStore((s) => s.locale);

  const t = useCallback(
    (key: string): string => {
      const keys = key.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let result: any = messages[locale];
      for (const k of keys) {
        result = result?.[k];
      }
      return (result as string) ?? key;
    },
    [locale]
  );

  return { t, locale };
}
