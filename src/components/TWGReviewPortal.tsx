'use client';

import React, { useState, useMemo } from 'react';
import MathRenderer from './MathRenderer';
import { cn } from '@/utils/cn';
import { createClient } from '@/lib/supabase/client';

interface TWGReviewPortalProps {
  finalDraftContent: string;
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
}

export default function TWGReviewPortal({ finalDraftContent, showLeftPanel = true, showRightPanel = true }: TWGReviewPortalProps) {
  const [comments, setComments] = useState<Record<string, string>>({});
  const [isSubmitted, setIsSubmitted] = useState(false);

  const MAX_CHARS = 5000;

  const headings = useMemo(() => {
    if (!finalDraftContent) return [];
    const regex = /^##\s+(.*)$/gm;
    const matches = [];
    let match;
    while ((match = regex.exec(finalDraftContent)) !== null) {
      matches.push(match[1].trim());
    }
    return matches;
  }, [finalDraftContent]);

  const scrollToHeading = (heading: string) => {
    const elements = document.querySelectorAll('h2');
    for (let el of Array.from(elements)) {
      if (el.textContent === heading) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
    }
  };

  const handleCommentChange = (section: string, value: string) => {
    setComments(prev => ({ ...prev, [section]: value }));
  };

  const handleSave = () => {
    alert('Progress saved to local storage.');
  };

  const handleSubmit = async () => {
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
      alert('You must be logged in to submit a review.');
      return;
    }

    const { error } = await supabase.from('matrix_reviews').upsert({
      user_id: session.user.id,
      status: 'SUBMITTED',
      poll_data: {},
      comments_data: comments
    });

    if (error) {
      console.error('Error submitting review:', error);
      alert('There was an error submitting your review.');
      return;
    }

    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl animate-in fade-in zoom-in duration-300 w-full h-full">
        <svg className="w-16 h-16 text-emerald-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-2xl font-bold text-emerald-900 dark:text-emerald-300 mb-2">Review Submitted</h2>
        <p className="text-emerald-700 dark:text-emerald-400 text-center max-w-lg mb-6">
          Your comprehensive review has been logged and flagged for author consideration. Thank you!
        </p>
        <button 
          onClick={() => setIsSubmitted(false)}
          className="px-4 py-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          Return to Draft
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Left Sidebar (TOC) */}
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-slate-50 dark:bg-slate-900/50 border-r border-slate-200 dark:border-slate-800 flex flex-col', showLeftPanel ? 'w-80' : 'w-0')}>
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 shrink-0">
          <h3 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">TABLE OF CONTENTS</h3>
        </div>
        <div className="p-6 overflow-y-auto flex-1">
          <ul className="space-y-3">
            {headings.map((heading, idx) => (
              <li 
                key={idx} 
                onClick={() => scrollToHeading(heading)}
                className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400 cursor-pointer transition-colors"
              >
                {heading}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Center Content (Document) */}
      <div className="flex-1 relative overflow-y-auto bg-white dark:bg-slate-950 px-8 py-10 sm:px-12">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Final Master Draft</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Review the concatenated policy options below.</p>
            </div>
            <button className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Draft (PDF)
            </button>
          </div>
          <MathRenderer content={finalDraftContent || ''} />
        </div>
      </div>

      {/* Right Drawer (Comments) */}
      <div className={cn('transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col relative', showRightPanel ? 'w-96' : 'w-0')}>
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-900/50">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-3">
            <svg className="w-5 h-5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span>Section Comments</span>
          </h3>
          <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50">
            Reviews can be saved and updated at any time. Submitting simply flags your review as ready for author consideration.
          </p>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 pb-32">
          <div className="space-y-2">
            <label className="text-sm font-bold text-slate-900 dark:text-slate-100">General Comments</label>
            <textarea 
              value={comments['General'] || ''}
              onChange={(e) => handleCommentChange('General', e.target.value)}
              maxLength={MAX_CHARS}
              placeholder="Overall thoughts on the methodology..."
              className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
              rows={4}
            />
            <div className={cn("text-right text-xs mt-1 transition-colors", (comments['General']?.length || 0) >= MAX_CHARS ? "text-rose-500 font-bold" : "text-slate-500")}>
              {comments['General']?.length || 0} / {MAX_CHARS}
            </div>
          </div>

          {headings.map((heading, idx) => (
            <div key={idx} className="space-y-2">
              <label className="text-sm font-bold text-slate-900 dark:text-slate-100">Comments on {heading}</label>
              <textarea 
                value={comments[heading] || ''}
                onChange={(e) => handleCommentChange(heading, e.target.value)}
                maxLength={MAX_CHARS}
                placeholder={`Specific feedback for ${heading}...`}
                className="w-full p-3 text-sm bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-sky-500 resize-y"
                rows={3}
              />
              <div className={cn("text-right text-xs mt-1 transition-colors", (comments[heading]?.length || 0) >= MAX_CHARS ? "text-rose-500 font-bold" : "text-slate-500")}>
                {comments[heading]?.length || 0} / {MAX_CHARS}
              </div>
            </div>
          ))}
        </div>

        {/* Sticky Bottom Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-3 shadow-[0_-10px_20px_-5px_rgba(0,0,0,0.05)]">
          <button 
            onClick={handleSave}
            className="flex-1 py-2 px-4 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            Save Draft
          </button>
          <button 
            onClick={handleSubmit}
            className="flex-1 py-2 px-4 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg shadow-md transition-colors"
          >
            Submit Review
          </button>
        </div>
      </div>
    </>
  );
}
