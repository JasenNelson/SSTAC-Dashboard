/**
 * ExportPanel Component
 *
 * Export assessment results and data
 */

'use client';

import { useState } from 'react';
import { cn } from '@/utils/cn';
import { useSiteDataStore } from '@/stores/bn-rrm/siteDataStore';
import type { SiteData, SiteAssessment } from '@/types/bn-rrm/site-data';
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  CheckCircle,
} from 'lucide-react';

type ExportFormat = 'csv' | 'json' | 'pdf';

export function ExportPanel() {
  const { sites, assessments } = useSiteDataStore();
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const siteCount = Object.keys(sites).length;
  const assessmentCount = Object.keys(assessments).length;

  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    // Simulate export
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate export data
    const exportData = generateExportData(selectedFormat, sites, assessments);

    // Download file
    downloadFile(exportData.content, exportData.filename, exportData.mimeType);

    setIsExporting(false);
    setExportComplete(true);

    setTimeout(() => setExportComplete(false), 3000);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-slate-800 dark:text-slate-100 mb-3">Export Format</h3>
        <div className="grid grid-cols-3 gap-2">
          <FormatOption
            format="csv"
            label="CSV"
            description="Spreadsheet format"
            icon={FileSpreadsheet}
            selected={selectedFormat === 'csv'}
            onClick={() => setSelectedFormat('csv')}
          />
          <FormatOption
            format="json"
            label="JSON"
            description="Full model state"
            icon={FileJson}
            selected={selectedFormat === 'json'}
            onClick={() => setSelectedFormat('json')}
          />
          <FormatOption
            format="pdf"
            label="PDF Report"
            description="Assessment report"
            icon={FileText}
            selected={selectedFormat === 'pdf'}
            onClick={() => setSelectedFormat('pdf')}
            disabled
          />
        </div>
      </div>

      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
        <h4 className="font-medium text-slate-700 dark:text-slate-300 mb-2">Export Summary</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Sites</span>
            <span className="font-medium">{siteCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Assessments completed</span>
            <span className="font-medium">{assessmentCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500 dark:text-slate-400">Format</span>
            <span className="font-medium uppercase">{selectedFormat}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={siteCount === 0 || isExporting}
        className={cn(
          'w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-colors',
          siteCount === 0
            ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
            : exportComplete
            ? 'bg-green-500 text-white'
            : 'bg-blue-500 text-white hover:bg-blue-600'
        )}
      >
        {isExporting ? (
          <>
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Exporting...
          </>
        ) : exportComplete ? (
          <>
            <CheckCircle className="w-5 h-5" />
            Downloaded!
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Export Data
          </>
        )}
      </button>

      {siteCount === 0 && (
        <p className="text-xs text-center text-slate-400 dark:text-slate-500">
          Upload site data first to enable export
        </p>
      )}
    </div>
  );
}

interface FormatOptionProps {
  format: ExportFormat;
  label: string;
  description: string;
  icon: typeof FileText;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function FormatOption({
  format: _format,
  label,
  description,
  icon: Icon,
  selected,
  onClick,
  disabled,
}: FormatOptionProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'p-3 rounded-lg border-2 text-left transition-all',
        selected
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
          : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <Icon
        className={cn('w-6 h-6 mb-2', selected ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500')}
      />
      <p className={cn('font-medium text-sm', selected ? 'text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300')}>
        {label}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      {disabled && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 block">Coming soon</span>
      )}
    </button>
  );
}

function generateExportData(
  format: ExportFormat,
  sites: Record<string, SiteData>,
  assessments: Record<string, SiteAssessment>
): { content: string; filename: string; mimeType: string } {
  const siteArray = Object.values(sites);
  const assessmentArray = Object.values(assessments);
  const timestamp = new Date().toISOString().split('T')[0];

  if (format === 'json') {
    const data = {
      exportDate: new Date().toISOString(),
      sites: siteArray,
      assessments: assessmentArray,
    };
    return {
      content: JSON.stringify(data, null, 2),
      filename: `openpra-export-${timestamp}.json`,
      mimeType: 'application/json',
    };
  }

  // CSV format
  const headers = [
    'site_id',
    'site_name',
    'latitude',
    'longitude',
    'site_type',
    'region',
    'sample_id',
    'copper',
    'zinc',
    'lead',
    'toc',
    'avs',
    'percent_fines',
    'impact_none',
    'impact_minor',
    'impact_moderate',
    'impact_severe',
  ];

  const rows = siteArray.flatMap((site) =>
    site.sedimentChemistry.map((chem) => {
      const assessment = assessmentArray.find((a) => a.siteId === site.location.id);
      return [
        site.location.id,
        site.location.name,
        site.location.latitude,
        site.location.longitude,
        site.location.siteType,
        site.location.region || '',
        chem.sampleId,
        chem.copper || '',
        chem.zinc || '',
        chem.lead || '',
        chem.toc || '',
        chem.avs || '',
        chem.percentFines || '',
        assessment?.impactProbabilities?.none || '',
        assessment?.impactProbabilities?.minor || '',
        assessment?.impactProbabilities?.moderate || '',
        assessment?.impactProbabilities?.severe || '',
      ].join(',');
    })
  );

  return {
    content: [headers.join(','), ...rows].join('\n'),
    filename: `openpra-export-${timestamp}.csv`,
    mimeType: 'text/csv',
  };
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default ExportPanel;
