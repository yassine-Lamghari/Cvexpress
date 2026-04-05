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

const downloadCV = useCallback(async (cvId: string, title: string, template: string) => {
    if (!user) return false;

    // Get fresh session token
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return false;

    // Obtenir le code LaTeX sauvegardé
    const { data: outputData } = await supabase
      .from('generated_outputs')
      .select('latex_code')
      .eq('cv_id', cvId)
      .eq('user_id', user.id)
      .single();

    const { data: cvInfo } = await supabase
      .from('cvs')
      .select('cv_data')
      .eq('id', cvId)
      .eq('user_id', user.id)
      .single();

    if (!outputData?.latex_code) return false;

    let photo = '';
    if (cvInfo?.cv_data?.personalInfo?.photo) {
      photo = cvInfo.cv_data.personalInfo.photo;
    }

    try {
      // Use the helper to get the correct API URL (handles NEXT_PUBLIC_LATEX_API_URL or defaults)
      const apiUrl = process.env.NEXT_PUBLIC_LATEX_API_URL || '/api';
      const endpoint = `${apiUrl}/latex/download`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
        },
        body: JSON.stringify({
          latexCode: outputData.latex_code,
          template: template || 'professional',
          photo
        }),
      });

      if (!response.ok) throw new Error(`Erreur de génération du PDF: ${response.statusText}`);

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'CV'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      return true;
    } catch (err) {
      // Download failed - user already sees the failure via the return value
      return false;
    }
  }, [user]);

  return { saveCV, loadCVs, loadCV, deleteCV, downloadCV, saving, saveStatus };
}
