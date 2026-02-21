'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X,
  Upload,
  FileText,
  FileSpreadsheet,
  FileImage,
  Check,
  Clock,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { isLocalEngineClient } from '@/lib/feature-flags';
import UnderConstruction from '@/components/ui/UnderConstruction';

// =============================================================================
// Types
// =============================================================================

interface ProjectFile {
  id: number;
  filename: string;
  file_size: number | null;
  file_type: string | null;
  processed: number;
  uploaded_at: string;
  processed_at: string | null;
}

interface FileManagementModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

// =============================================================================
// Helpers
// =============================================================================

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileTypeIcon({ type }: { type: string | null }) {
  if (type?.includes('pdf'))
    return <FileText className="h-5 w-5 text-red-500" />;
  if (type?.includes('spreadsheet') || type?.includes('excel'))
    return <FileSpreadsheet className="h-5 w-5 text-green-600" />;
  if (type?.includes('image'))
    return <FileImage className="h-5 w-5 text-blue-500" />;
  return <FileText className="h-5 w-5 text-gray-400" />;
}

// =============================================================================
// Component
// =============================================================================

export default function FileManagementModal({
  projectId,
  isOpen,
  onClose,
}: FileManagementModalProps) {
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/regulatory-review/projects/${projectId}/files`
      );
      if (!res.ok) throw new Error('Failed to load files');
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load files'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      setError(null);
      fetchFiles();
    }
  }, [isOpen, fetchFiles]);

  if (!isOpen) return null;

  const hasUnprocessed = files.some((f) => f.processed === 0);

  const uploadFiles = async (fileList: FileList | File[]) => {
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      Array.from(fileList).forEach((file) => formData.append('files', file));

      const res = await fetch(
        `/api/regulatory-review/projects/${projectId}/files`,
        { method: 'POST', body: formData }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }

      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: number) => {
    try {
      const res = await fetch(
        `/api/regulatory-review/projects/${projectId}/files/${fileId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed to delete file');
      setFiles((prev) => prev.filter((f) => f.id !== fileId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete file');
    }
  };

  const processNewFiles = async () => {
    setProcessing(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/regulatory-review/projects/${projectId}/extract`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'new' }),
        }
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Processing failed');
      }

      await fetchFiles();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Processing failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="file-mgmt-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h3
            id="file-mgmt-title"
            className="text-lg font-semibold text-gray-900 dark:text-white"
          >
            Manage Files
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        {!isLocalEngineClient() ? (
          <div className="px-6 py-4 flex-1">
            <UnderConstruction feature="File Management" />
          </div>
        ) : (
        <div className="px-6 py-4 overflow-y-auto flex-1 space-y-4">
          {/* Drop Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
              dragOver
                ? 'border-indigo-400 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
                : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-indigo-600 dark:text-indigo-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">Uploading...</span>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-gray-400 dark:text-gray-500 mb-2" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
                >
                  Choose files
                </button>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {' '}
                  or drag and drop
                </span>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  PDF, DOCX, XLSX, images
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.png,.jpg,.jpeg,.tiff,.tif"
                  onChange={handleFileInput}
                  className="hidden"
                />
              </>
            )}
          </div>

          {/* File List */}
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-400 dark:text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Loading files...
            </div>
          ) : files.length > 0 ? (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 py-3"
                >
                  <FileTypeIcon type={file.file_type} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatFileSize(file.file_size)}
                      {' -- '}
                      {new Date(file.uploaded_at).toLocaleDateString('en-CA')}
                    </p>
                  </div>
                  {file.processed ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                      <Check className="h-3 w-3" />
                      Processed
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-0.5 rounded-full">
                      <Clock className="h-3 w-3" />
                      Pending
                    </span>
                  )}
                  <button
                    onClick={() => deleteFile(file.id)}
                    className="p-1 text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded"
                    title="Delete file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-6">
              No files uploaded yet.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
        </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 rounded-b-lg flex-shrink-0">
          <div>
            {isLocalEngineClient() && hasUnprocessed && (
              <button
                onClick={processNewFiles}
                disabled={processing}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 dark:bg-emerald-500 rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                Process New Files
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
