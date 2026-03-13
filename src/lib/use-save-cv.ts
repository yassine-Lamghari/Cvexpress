'use client';

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import { useCVStore } from '@/stores/cv-store';
import type { GeneratedOutput } from '@/types/cv';

interface SavedCV {
  id: string;
  title: string;
  selected_template: string;
  updated_at: string;
}

export function useSaveCV() {
  const { user } = useAuth();
  const store = useCVStore();
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const lastSavedCvId = useRef<string | null>(null);

  const saveCV = useCallback(async (title?: string, generatedOutput?: GeneratedOutput | null) => {
    if (!user) return null;
    setSaving(true);
    setSaveStatus('idle');

    const cvPayload = {
      user_id: user.id,
      title: title || `${store.cvData.personalInfo.firstName} ${store.cvData.personalInfo.lastName}`.trim() || 'Mon CV',
      cv_data: store.cvData,
      job_offer: store.jobOffer,
      raw_resume: store.rawResume,
      raw_skills: store.rawSkills,
      selected_template: store.selectedTemplate,
      locale: store.locale,
    };

    let cvId = lastSavedCvId.current;

    if (cvId) {
      // Update existing
      const { error } = await supabase.from('cvs').update(cvPayload).eq('id', cvId).eq('user_id', user.id);
      if (error) {
        setSaving(false);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        return null;
      }
    } else {
      // Insert new
      const { data, error } = await supabase.from('cvs').insert(cvPayload).select('id').single();
      if (error || !data) {
        setSaving(false);
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
        return null;
      }
      cvId = data.id;
      lastSavedCvId.current = cvId;
    }

    // Save generated output if provided
    if (generatedOutput && cvId) {
      await supabase.from('generated_outputs').upsert({
        cv_id: cvId,
        user_id: user.id,
        adapted_cv: generatedOutput.adaptedCV,
        motivation_letter: generatedOutput.motivationLetter,
        candidacy_email: generatedOutput.candidacyEmail,
        latex_code: generatedOutput.latexCode || '',
      }, { onConflict: 'cv_id' });
    }

    setSaving(false);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 3000);
    return cvId;
  }, [user, store]);

  const loadCVs = useCallback(async (): Promise<SavedCV[]> => {
    if (!user) return [];
    const { data } = await supabase
      .from('cvs')
      .select('id, title, selected_template, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });
    return data ?? [];
  }, [user]);

  const loadCV = useCallback(async (cvId: string) => {
    if (!user) return;
    const { data } = await supabase
      .from('cvs')
      .select('*')
      .eq('id', cvId)
      .eq('user_id', user.id)
      .single();

    if (data) {
      store.setCVData(data.cv_data);
      store.setJobOffer(data.job_offer || '');
      store.setRawResume(data.raw_resume || '');
      store.setRawSkills(data.raw_skills || '');
      store.setSelectedTemplate(data.selected_template || 'professional');
      store.setLocale(data.locale || 'fr');
      lastSavedCvId.current = cvId;
    }
  }, [user, store]);

  const deleteCV = useCallback(async (cvId: string) => {
    if (!user) return;
    await supabase.from('cvs').delete().eq('id', cvId).eq('user_id', user.id);
    if (lastSavedCvId.current === cvId) lastSavedCvId.current = null;
  }, [user]);

  return { saveCV, loadCVs, loadCV, deleteCV, saving, saveStatus };
}
