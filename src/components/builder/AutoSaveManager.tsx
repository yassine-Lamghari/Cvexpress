'use client';

import { useEffect, useRef, useState } from 'react';
import { useCVStore } from '@/stores/cv-store';
import { useSaveCV } from '@/lib/use-save-cv';
import { useAuth } from '@/components/auth/AuthProvider';
import { CheckCircle2, Loader2, CloudAlert } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';

export default function AutoSaveManager() {
  const { user } = useAuth();
  const { 
    cvData, 
    jobOffer, 
    rawResume, 
    rawSkills, 
    selectedTemplate, 
    locale, 
    generatedOutput 
  } = useCVStore();
  
  const { saveCV, saving, saveStatus } = useSaveCV();
  const { t } = useTranslations();
  
  const [mounted, setMounted] = useState(false);
  const [showIndicator, setShowIndicator] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const hideIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Mark as mounted to prevent hydration mismatches
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Clear previous save timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Set new timer for autosave after 3s of inactivity
    timerRef.current = setTimeout(() => {
      setShowIndicator(true);

      if (user) {
        saveCV(undefined, generatedOutput).then(() => {
          if (hideIndicatorTimerRef.current) clearTimeout(hideIndicatorTimerRef.current);
          hideIndicatorTimerRef.current = setTimeout(() => {
            setShowIndicator(false);
          }, 3000);
        });
      } else {
        // Just show local save for non-authenticated users
        if (hideIndicatorTimerRef.current) clearTimeout(hideIndicatorTimerRef.current);
        hideIndicatorTimerRef.current = setTimeout(() => {
          setShowIndicator(false);
        }, 3000);
      }
    }, 3000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (hideIndicatorTimerRef.current) clearTimeout(hideIndicatorTimerRef.current);
    };
  }, [cvData, jobOffer, rawResume, rawSkills, selectedTemplate, locale, generatedOutput, user, saveCV, mounted]);

  if (!mounted || !showIndicator) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 shadow-lg rounded-full text-xs font-medium animate-in fade-in slide-in-from-bottom-5">
      {user ? (
        saving ? (
          <>
            <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
            <span className="text-gray-600">Sauvegarde auto...</span>
          </>
        ) : saveStatus === 'saved' ? (
          <>
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            <span className="text-gray-600">Sauvegardé</span>
          </>
        ) : saveStatus === 'error' ? (
          <>
            <CloudAlert className="w-3 h-3 text-red-500" />
            <span className="text-red-600">Erreur de sauvegarde</span>
          </>
        ) : null
      ) : (
        <>
          <CheckCircle2 className="w-3 h-3 text-green-500" />
          <span className="text-gray-600">Sauvegardé localement</span>
        </>
      )}
    </div>
  );
}
