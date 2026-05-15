import React from 'react';
import MatrixDashboard from '@/components/MatrixDashboard';
import fs from 'fs';
import path from 'path';

export const metadata = {
  title: 'Matrix Options Analysis | SSTAC Dashboard',
  description: 'Collaborative policy review dashboard for sediment quality standards.',
};

export default async function MatrixOptionsPage() {
  const readDraft = (filename: string) => {
    try {
      const filePath = path.join('C:\\Projects\\SSTAC-Dashboard\\matrix_research\\content_drafts', filename);
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      } else {
        const fallbackPath = path.join(process.cwd(), 'matrix_research', 'content_drafts', filename);
        if (fs.existsSync(fallbackPath)) {
          return fs.readFileSync(fallbackPath, 'utf8');
        }
      }
    } catch (error) {
      console.error(`Failed to load ${filename}`, error);
    }
    return `Error loading ${filename}.`;
  };

  const eqpCaseStudyContent = readDraft('CaseStudy_EqP_AVS.md');
  const bsafCaseStudyContent = readDraft('CaseStudy_BSAF.md');
  const humanHealthContent = readDraft('Framework_HumanHealth.md');
  const guideContent = readDraft('The_Guide.md');

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Matrix Standards Derivation Options
        </h1>
        <p className="mt-2 text-md text-slate-600 dark:text-slate-400 max-w-4xl leading-relaxed">
          Collaborative Policy Review Dashboard. Select a tab below to explore the pathways, methodologies, and proposed framework options.
        </p>
      </div>
      
      <MatrixDashboard 
        eqpCaseStudyContent={eqpCaseStudyContent} 
        bsafCaseStudyContent={bsafCaseStudyContent}
        humanHealthContent={humanHealthContent}
        guideContent={guideContent}
      />
    </div>
  );
}
