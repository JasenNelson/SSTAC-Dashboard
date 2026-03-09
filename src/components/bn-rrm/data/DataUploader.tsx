/**
 * DataUploader Component
 *
 * Handles file upload, parsing, and validation for site data
 */

'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/utils/cn';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import type { SiteData, SedimentChemistry } from '@/types/bn-rrm/site-data';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  HelpCircle,
} from 'lucide-react';

interface DataUploaderProps {
  onUploadComplete?: (sites: SiteData[]) => void;
}

export function DataUploader({ onUploadComplete }: DataUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'parsing' | 'validating' | 'complete' | 'error'>('idle');
  const [uploadResult, setUploadResult] = useState<{
    sites: number;
    samples: number;
    warnings: string[];
    errors: string[];
  } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { addSites } = useSiteDataStore();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFile = async (file: File) => {
    setSelectedFile(file);
    setUploadState('parsing');
    setUploadResult(null);

    try {
      // Simulate parsing delay
      await new Promise((resolve) => setTimeout(resolve, 500));
      setUploadState('validating');

      // Parse file based on type
      const sites = await parseFile(file);

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Validate and add to store
      const warnings: string[] = [];
      const errors: string[] = [];

      sites.forEach((site) => {
        site.sedimentChemistry.forEach((chem) => {
          if (chem.copper && chem.copper > 197) {
            warnings.push(`${site.location.name}: Copper exceeds PEL (${chem.copper} mg/kg)`);
          }
          if (chem.zinc && chem.zinc > 315) {
            warnings.push(`${site.location.name}: Zinc exceeds PEL (${chem.zinc} mg/kg)`);
          }
        });
      });

      addSites(sites);

      setUploadResult({
        sites: sites.length,
        samples: sites.reduce((acc, s) => acc + s.sedimentChemistry.length, 0),
        warnings,
        errors,
      });
      setUploadState('complete');
      onUploadComplete?.(sites);
    } catch (error) {
      setUploadState('error');
      setUploadResult({
        sites: 0,
        samples: 0,
        warnings: [],
        errors: [(error as Error).message],
      });
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setUploadState('idle');
    setUploadResult(null);
  };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200',
          isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
            : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 bg-slate-50 dark:bg-slate-700/50',
          uploadState !== 'idle' && 'pointer-events-none opacity-50'
        )}
      >
        <input
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          onChange={handleFileSelect}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={uploadState !== 'idle'}
        />

        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            'w-16 h-16 rounded-2xl flex items-center justify-center',
            isDragging ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-slate-100 dark:bg-slate-700'
          )}>
            <Upload className={cn('w-8 h-8', isDragging ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500')} />
          </div>

          <div>
            <p className="font-medium text-slate-700 dark:text-slate-300">
              {isDragging ? 'Drop file here' : 'Drag & drop site data file'}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              or click to browse
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
            <span className="flex items-center gap-1">
              <FileSpreadsheet className="w-4 h-4" />
              CSV, Excel
            </span>
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              JSON
            </span>
          </div>
        </div>
      </div>

      {/* Upload progress/result */}
      {selectedFile && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              <div>
                <p className="font-medium text-slate-700 dark:text-slate-300">{selectedFile.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>

            {uploadState === 'complete' && (
              <button
                onClick={resetUpload}
                className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Status */}
          <div className="mt-4">
            {uploadState === 'parsing' && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Parsing file...</span>
              </div>
            )}

            {uploadState === 'validating' && (
              <div className="flex items-center gap-2 text-blue-600">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Validating data against guidelines...</span>
              </div>
            )}

            {uploadState === 'complete' && uploadResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Upload complete</span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{uploadResult.sites}</p>
                    <p className="text-slate-500 dark:text-slate-400">Sites loaded</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
                    <p className="text-2xl font-bold text-slate-800 dark:text-slate-100">{uploadResult.samples}</p>
                    <p className="text-slate-500 dark:text-slate-400">Samples</p>
                  </div>
                </div>

                {uploadResult.warnings.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                    <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300 font-medium mb-2">
                      <AlertTriangle className="w-4 h-4" />
                      {uploadResult.warnings.length} Warning(s)
                    </div>
                    <ul className="text-sm text-yellow-600 dark:text-yellow-400 space-y-1">
                      {uploadResult.warnings.slice(0, 5).map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                      {uploadResult.warnings.length > 5 && (
                        <li className="text-yellow-500">
                          +{uploadResult.warnings.length - 5} more...
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {uploadState === 'error' && uploadResult && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-medium">
                  <AlertCircle className="w-4 h-4" />
                  Upload failed
                </div>
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                  {uploadResult.errors[0]}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Template download */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Need a template?</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">Download our data template with example data</p>
          </div>
        </div>
        <button className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
          <Download className="w-4 h-4" />
          Template
        </button>
      </div>
    </div>
  );
}

// Helper function to parse uploaded files
async function parseFile(file: File): Promise<SiteData[]> {
  const text = await file.text();
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'json') {
    return JSON.parse(text);
  }

  if (extension === 'csv') {
    return parseCSV(text);
  }

  throw new Error(`Unsupported file format: ${extension}`);
}

function parseCSV(text: string): SiteData[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows');

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const sites = new Map<string, SiteData>();

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map((v) => v.trim());
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });

    const siteId = row['site_id'] || row['siteid'] || `site_${i}`;

    if (!sites.has(siteId)) {
      sites.set(siteId, {
        location: {
          id: siteId,
          name: row['site_name'] || row['sitename'] || siteId,
          latitude: parseFloat(row['latitude'] || row['lat']) || 0,
          longitude: parseFloat(row['longitude'] || row['lon'] || row['long']) || 0,
          siteType: (row['site_type'] || 'exposure') as 'reference' | 'exposure' | 'gradient',
          region: row['region'],
          waterbody: row['waterbody'],
          dateCollected: row['date'] || new Date().toISOString().split('T')[0],
        },
        sedimentChemistry: [],
      });
    }

    const site = sites.get(siteId)!;

    const chemistry: SedimentChemistry = {
      siteId,
      sampleId: row['sample_id'] || row['sampleid'] || `${siteId}_${site.sedimentChemistry.length + 1}`,
      dateCollected: row['date'] || new Date().toISOString().split('T')[0],
      copper: parseFloat(row['copper'] || row['cu']) || undefined,
      zinc: parseFloat(row['zinc'] || row['zn']) || undefined,
      lead: parseFloat(row['lead'] || row['pb']) || undefined,
      cadmium: parseFloat(row['cadmium'] || row['cd']) || undefined,
      mercury: parseFloat(row['mercury'] || row['hg']) || undefined,
      arsenic: parseFloat(row['arsenic'] || row['as']) || undefined,
      chromium: parseFloat(row['chromium'] || row['cr']) || undefined,
      totalPAHs: parseFloat(row['total_pahs'] || row['pahs']) || undefined,
      toc: parseFloat(row['toc']) || undefined,
      avs: parseFloat(row['avs']) || undefined,
      percentFines: parseFloat(row['percent_fines'] || row['fines']) || undefined,
    };

    site.sedimentChemistry.push(chemistry);
  }

  return Array.from(sites.values());
}

export default DataUploader;
