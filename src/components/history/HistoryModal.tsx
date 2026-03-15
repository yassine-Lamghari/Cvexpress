'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { X, Clock, Trash2, FolderOpen, Loader2, FileText, Download } from 'lucide-react';
import { useSaveCV } from '@/lib/use-save-cv';

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
}

interface SavedCV {
  id: string;
  title: string;
  selected_template: string;
  updated_at: string;
}

export default function HistoryModal({ open, onClose }: HistoryModalProps) {
  const { loadCVs, loadCV, deleteCV, downloadCV } = useSaveCV();
  const [cvs, setCvs] = useState<SavedCV[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchCVs = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await loadCVs();
      setCvs(data);
    } catch (error) {
      console.error('Failed to load CVs', error);
    } finally {
      setIsLoading(false);
    }
  }, [loadCVs]);

  useEffect(() => {
    if (open) {
      fetchCVs();
    } else {
      setCvs([]);
      setIsActionLoading(null);
    }
  }, [open, fetchCVs]);

  const handleLoad = async (id: string) => {
    setIsActionLoading(id);
    try {
      await loadCV(id);
      onClose(); // close the modal after it's loaded successfully
    } catch (error) {
      console.error('Failed to load CV', error);
      setIsActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    setIsActionLoading(id);
    try {
      await deleteCV(id);
      await fetchCVs(); // reload the list
    } catch (error) {
      console.error('Failed to delete CV', error);
    } finally {
      setIsActionLoading(null);
    }
  };

  const handleDownload = async (id: string, title: string, template: string) => {
    setDownloadingId(id);
    try {
      const success = await downloadCV(id, title, template);
      if (!success) {
        alert("Impossible de tÃ©lÃ©charger le CV (Le code LaTeX n'est peut-Ãªtre pas encore gÃ©nÃ©rÃ© pour ce CV).");
      }
    } catch (error) {
      console.error('Failed to download CV', error);
    } finally {
      setDownloadingId(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${day}/${month}/${year} à ${hours}:${minutes}`;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Historique de vos CVs</h2>
            <p className="text-sm text-gray-500 mt-1">
              Retrouvez et modifiez vos modèles sauvegardés
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-600" />
              <p>Chargement de vos CVs...</p>
            </div>
          ) : cvs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <div className="mb-4 rounded-full bg-gray-100 p-4">
                <FileText className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-lg font-medium text-gray-900">Aucun CV sauvegardé</p>
              <p className="mt-1 text-sm">Vos CVs sauvegardés apparaîtront ici.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cvs.map((cv) => (
                <div
                  key={cv.id}
                  className="group relative flex flex-col justify-between gap-4 rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-blue-100 hover:shadow-md sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {cv.title || 'CV Sans Titre'}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                      <span className="flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        <FileText className="h-3.5 w-3.5" />
                        {cv.selected_template}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        {formatDate(cv.updated_at)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDownload(cv.id, cv.title, cv.selected_template)}
                      disabled={downloadingId === cv.id || isActionLoading === cv.id}
                      className="flex items-center justify-center rounded-lg border border-green-100 bg-green-50 p-2 text-green-600 transition-colors hover:bg-green-100 disabled:opacity-50"
                      title="Télécharger en PDF"
                    >
                      {downloadingId === cv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleLoad(cv.id)}
                      disabled={isActionLoading === cv.id || downloadingId === cv.id}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50 sm:flex-none"
                    >
                      {isActionLoading === cv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FolderOpen className="h-4 w-4" />
                      )}
                      Charger
                    </button>
                    <button
                      onClick={() => handleDelete(cv.id)}
                      disabled={isActionLoading === cv.id || downloadingId === cv.id}
                      className="flex items-center justify-center rounded-lg border border-red-100 bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
                      title="Supprimer"
                    >
                      {isActionLoading === cv.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
