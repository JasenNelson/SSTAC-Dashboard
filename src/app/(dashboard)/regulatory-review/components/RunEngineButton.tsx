'use client';

import { useState } from 'react';
import { Play, Loader2, CheckCircle2, AlertCircle, Upload, X, Download } from 'lucide-react';

interface RunEngineButtonProps {
  submissionId: string;
  siteId: string;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}

type EngineStatus = 'idle' | 'running' | 'success' | 'error';
type RunMode = 'existing' | 'upload' | 'import';

interface RunEngineResponse {
  success: boolean;
  submissionId?: string;
  summary?: {
    totalItems: number;
    passCount: number;
    failCount: number;
    partialCount: number;
    requiresJudgmentCount: number;
    overallCoverage: number;
  };
  importResult?: {
    submissionCreated: boolean;
    assessmentsImported: number;
  };
  error?: string;
  outputPath?: string;
}

export default function RunEngineButton({
  submissionId,
  siteId,
  disabled = false,
  variant = 'secondary',
}: RunEngineButtonProps) {
  const [status, setStatus] = useState<EngineStatus>('idle');
  const [result, setResult] = useState<RunEngineResponse | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [runMode, setRunMode] = useState<RunMode>('import');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleRunEngine = async () => {
    setStatus('running');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('submissionId', submissionId);
      formData.append('siteId', siteId);
      formData.append('mode', runMode);

      if (runMode === 'upload' && selectedFiles.length > 0) {
        selectedFiles.forEach((file) => {
          formData.append('files', file);
        });
      }

      const response = await fetch('/api/regulatory-review/run-engine', {
        method: 'POST',
        body: formData,
      });

      const data: RunEngineResponse = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setResult(data);
      } else {
        setStatus('error');
        setResult(data);
      }
    } catch (error) {
      setStatus('error');
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run evaluation engine',
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).filter(
        (f) => f.name.endsWith('.json') || f.name.endsWith('.pdf')
      );
      setSelectedFiles(files);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const baseButtonClass = variant === 'primary'
    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100';

  const buttonContent = () => {
    switch (status) {
      case 'running':
        return (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Running Engine...
          </>
        );
      case 'success':
        return (
          <>
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Complete
          </>
        );
      case 'error':
        return (
          <>
            <AlertCircle className="h-4 w-4 mr-2" />
            Error
          </>
        );
      default:
        return (
          <>
            <Play className="h-4 w-4 mr-2" />
            Run Engine
          </>
        );
    }
  };

  const getButtonClass = () => {
    if (status === 'success') {
      return 'bg-green-50 text-green-600 cursor-default';
    }
    if (status === 'error') {
      return 'bg-red-50 text-red-600 hover:bg-red-100';
    }
    if (status === 'running') {
      return 'bg-yellow-50 text-yellow-600 cursor-wait';
    }
    return baseButtonClass;
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        disabled={disabled || status === 'running'}
        className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${getButtonClass()}`}
      >
        {buttonContent()}
      </button>

      {/* Modal for Run Engine options */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Run Evaluation Engine
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4 space-y-4">
              {/* Submission Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Submission ID:</span>
                  <span className="font-medium text-gray-900">{submissionId}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-gray-500">Site:</span>
                  <span className="font-medium text-gray-900">{siteId}</span>
                </div>
              </div>

              {/* Mode Selection */}
              <div className="space-y-3">
                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="mode"
                    checked={runMode === 'import'}
                    onChange={() => setRunMode('import')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="font-medium text-gray-900">Import Latest Results</span>
                      <p className="text-sm text-gray-500">Import from most recent evaluation output file (recommended)</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="mode"
                    checked={runMode === 'existing'}
                    onChange={() => setRunMode('existing')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Play className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="font-medium text-gray-900">Run Engine (Existing Extractions)</span>
                      <p className="text-sm text-gray-500">Re-run evaluation on extraction files in the system</p>
                    </div>
                  </div>
                </label>

                <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="mode"
                    checked={runMode === 'upload'}
                    onChange={() => setRunMode('upload')}
                    className="text-emerald-600 focus:ring-emerald-500"
                  />
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-purple-600" />
                    <div>
                      <span className="font-medium text-gray-900">Upload New Documents</span>
                      <p className="text-sm text-gray-500">Upload extraction JSON files to process</p>
                    </div>
                  </div>
                </label>
              </div>

              {/* File Upload (when upload mode is selected) */}
              {runMode === 'upload' && (
                <div className="space-y-3">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-emerald-400 transition-colors">
                    <Upload className="w-8 h-8 mx-auto text-gray-400 mb-2" />
                    <label className="cursor-pointer">
                      <span className="text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                        Choose files
                      </span>
                      <span className="text-sm text-gray-500"> or drag and drop</span>
                      <input
                        type="file"
                        multiple
                        accept=".json,.pdf"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-xs text-gray-400 mt-1">JSON or PDF files</p>
                  </div>

                  {/* Selected Files */}
                  {selectedFiles.length > 0 && (
                    <div className="space-y-2">
                      {selectedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between bg-gray-50 rounded px-3 py-2"
                        >
                          <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          <button
                            onClick={() => removeFile(index)}
                            className="p-1 text-gray-400 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Result Display */}
              {result && (
                <div
                  className={`rounded-lg p-4 ${
                    result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                  }`}
                >
                  {result.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center text-green-700">
                        <CheckCircle2 className="w-5 h-5 mr-2" />
                        <span className="font-medium">Import Complete</span>
                      </div>
                      {result.importResult && (
                        <div className="text-sm text-green-700 bg-green-100 rounded px-3 py-2">
                          Imported {result.importResult.assessmentsImported} assessments
                        </div>
                      )}
                      {result.summary && (
                        <div className="grid grid-cols-2 gap-2 text-sm text-green-800">
                          <div>Total Items: {result.summary.totalItems}</div>
                          <div>Pass: {result.summary.passCount}</div>
                          <div>Fail: {result.summary.failCount}</div>
                          <div>Partial: {result.summary.partialCount}</div>
                          <div>Requires Judgment: {result.summary.requiresJudgmentCount}</div>
                          <div>Coverage: {(result.summary.overallCoverage * 100).toFixed(1)}%</div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-start text-red-700">
                      <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-medium">Error</span>
                        <p className="text-sm mt-1">{result.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
              <button
                onClick={() => {
                  setShowModal(false);
                  if (result?.success) {
                    window.location.reload();
                  }
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                {result?.success ? 'Close & Refresh' : 'Cancel'}
              </button>
              <button
                onClick={handleRunEngine}
                disabled={status === 'running' || (runMode === 'upload' && selectedFiles.length === 0)}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'running' ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run Engine
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
