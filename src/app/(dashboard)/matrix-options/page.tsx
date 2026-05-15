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

  const readFinalPaper = () => {
    try {
      const filePath = path.join('C:\\Projects\\SSTAC-Dashboard\\matrix_research\\options_paper\\BC_Matrix_Options_Paper_FINAL_DRAFT.md');
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      } else {
        const fallbackPath = path.join(process.cwd(), 'matrix_research', 'options_paper', 'BC_Matrix_Options_Paper_FINAL_DRAFT.md');
        if (fs.existsSync(fallbackPath)) {
          return fs.readFileSync(fallbackPath, 'utf8');
        }
      }
    } catch (error) {
      console.error('Failed to load final paper', error);
    }
    return 'Error loading final paper.';
  };

  const eqpCaseStudyContent = readDraft('CaseStudy_EqP_AVS.md');
  const bsafCaseStudyContent = readDraft('CaseStudy_BSAF.md');
  const humanHealthContent = readDraft('Framework_HumanHealth.md');
  const guideContent = readDraft('The_Guide.md');
  const finalDraftContent = readFinalPaper();

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] w-full overflow-hidden">
      <MatrixDashboard 
        eqpCaseStudyContent={eqpCaseStudyContent} 
        bsafCaseStudyContent={bsafCaseStudyContent}
        humanHealthContent={humanHealthContent}
        guideContent={guideContent}
        finalDraftContent={finalDraftContent}
      />
    </div>
  );
}
