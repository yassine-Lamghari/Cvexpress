'use client';

import { useEffect } from 'react';
import { useCVStore } from '@/stores/cv-store';

/** Syncs the <html lang="..."> attribute with the Zustand locale */
export default function HtmlLangSync() {
  const locale = useCVStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  return null;
}
