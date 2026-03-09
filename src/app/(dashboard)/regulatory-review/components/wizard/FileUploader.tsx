'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FileText, Table, File, Image, X } from 'lucide-react';
import { type WizardFile, ACCEPTED_FILE_TYPES } from './types';

interface FileUploaderProps {
  files: WizardFile[];
  onAdd: (files: WizardFile[]) => void;
  onRemove: (fileId: string) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(type: string) {
  if (type === 'application/pdf') return FileText;
  if (type.includes('spreadsheet') || type.includes('excel')) return Table;
  if (type.startsWith('image/')) return Image;
  return File;
}

const acceptString = Object.entries(ACCEPTED_FILE_TYPES)
  .flatMap(([mime, exts]) => [mime, ...exts])
  .join(',');

export default function FileUploader({ files, onAdd, onRemove }: FileUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const newFiles: WizardFile[] = Array.from(fileList).map((file) => ({
        id: crypto.randomUUID(),
        name: file.name,
        size: file.size,
        type: file.type,
        file,
      }));
      onAdd(newFiles);
    },
    [onAdd],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Upload Files</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Upload submission documents for processing. Accepts PDF, Excel, Word, and image files.
        </p>
      </div>

      {/* Drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          w-full rounded-lg border-2 border-dashed p-8
          flex flex-col items-center justify-center gap-3
          transition-colors duration-200 cursor-pointer
          ${isDragOver
            ? 'border-sky-400 dark:border-sky-500 bg-sky-50 dark:bg-sky-900/20'
            : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
          }
        `}
      >
        <Upload
          className={`w-10 h-10 ${isDragOver ? 'text-sky-500' : 'text-slate-400 dark:text-slate-500'}`}
        />
        <div className="text-center">
          <span className="text-sm font-medium text-sky-600 dark:text-sky-400">Click to browse</span>
          <span className="text-sm text-slate-500 dark:text-slate-400"> or drag and drop files here</span>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          PDF, Excel, Word, Images
        </p>
      </button>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={acceptString}
        onChange={(e) => {
          handleFiles(e.target.files);
          // Reset so same file can be re-added
          e.target.value = '';
        }}
        className="hidden"
      />

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
            <span>
              {files.length} {files.length === 1 ? 'file' : 'files'}
            </span>
            <span>{formatFileSize(totalSize)}</span>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            {files.map((file) => {
              const Icon = getFileIcon(file.type);
              return (
                <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Icon className="w-5 h-5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                  <span className="flex-1 min-w-0 text-sm text-slate-600 dark:text-slate-300 truncate">
                    {file.name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(file.id)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={`Remove ${file.name}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
