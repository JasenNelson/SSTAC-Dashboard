import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MathRendererProps {
  content: string;
}

export default function MathRenderer({ content }: MathRendererProps) {
  return (
    <div className="prose prose-slate dark:prose-invert max-w-none math-renderer leading-relaxed text-slate-800 dark:text-slate-200 [&>p]:mb-6 [&>h1]:mb-6 [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:text-slate-900 dark:[&>h1]:text-white [&>h2]:mb-4 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:text-slate-800 dark:[&>h2]:text-slate-100 [&>h3]:mb-4 [&>h3]:text-xl [&>h3]:font-bold [&>h3]:text-slate-800 dark:[&>h3]:text-slate-100 [&_.math-display]:my-8 [&_.math-display]:py-2 [&_.math-display]:overflow-x-auto [&_li]:mb-2 [&_ul]:mb-6 [&_ul]:list-disc [&_ul]:pl-6">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
