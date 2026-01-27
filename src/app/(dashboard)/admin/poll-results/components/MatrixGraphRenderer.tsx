'use client';

import React from 'react';
import { PollResult, MatrixData } from '../types';
import PrioritizationMatrixGraph from '@/components/graphs/PrioritizationMatrixGraph';

interface MatrixGraphRendererProps {
  selectedPoll: PollResult;
  matrixData: MatrixData[];
  showMatrixGraphs: { [key: string]: boolean };
  toggleMatrixGraph: (questionPairKey: string) => void;
  exportMatrixGraph: (graph: MatrixData, q1Text: string, q2Text: string, title: string) => void;
  filteredPolls: PollResult[];
}

export default function MatrixGraphRenderer({
  selectedPoll,
  matrixData,
  showMatrixGraphs,
  toggleMatrixGraph,
  exportMatrixGraph,
  filteredPolls
}: MatrixGraphRendererProps) {
  // Don't render anything if no matrix data
  if (!matrixData || matrixData.length === 0) {
    return null;
  }

  // Prioritization Matrix Graphs - Show only after Question 2 (poll_index 1)
  if (selectedPoll.page_path.includes('prioritization') && selectedPoll.poll_index === 1) {
    const specificGraph = matrixData[0];
    const questionPairKey = 'prioritization-q1-q2';
    const isVisible = showMatrixGraphs[questionPairKey];

    if (!specificGraph) return null;

    return (
      <div className="mt-6">
        {/* Toggle and Export Buttons */}
        <div className="flex justify-center gap-3 mb-4">
          <button
            onClick={() => toggleMatrixGraph(questionPairKey)}
            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
          >
            {isVisible ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Hide Matrix Graph
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Show Matrix Graph
              </>
            )}
          </button>
          <button
            onClick={() => {
              const q1Poll = filteredPolls.find(
                (p) => p.page_path.includes('prioritization') && p.poll_index === 0
              );
              const q2Poll = filteredPolls.find(
                (p) => p.page_path.includes('prioritization') && p.poll_index === 1
              );
              const q1Text = q1Poll?.question || 'Question 1';
              const q2Text = q2Poll?.question || 'Question 2';
              exportMatrixGraph(specificGraph, q1Text, q2Text, 'Prioritization Q1-Q2');
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
            title="Export matrix graph data to CSV"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Matrix Graph - Conditionally Rendered */}
        {isVisible && (
          <div className="p-6 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-900/20 dark:to-indigo-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">
              Prioritization
            </h3>
            <div className="flex justify-center">
              <div className="w-full max-w-4xl">
                <PrioritizationMatrixGraph key={specificGraph.title} {...specificGraph} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Holistic Protection Matrix Graphs - Show on feasibility questions (1, 3, 5, 7)
  if (
    selectedPoll.page_path.includes('holistic-protection') &&
    [1, 3, 5, 7].includes(selectedPoll.poll_index)
  ) {
    // Find the specific graph for this question pair (offset by 1 since holistic starts at index 1 in matrixData)
    const questionPairIndex = [1, 3, 5, 7].indexOf(selectedPoll.poll_index);
    const specificGraph = matrixData[questionPairIndex + 1]; // +1 because index 0 is prioritization

    if (!specificGraph) return null;

    // Create unique key for each question pair
    const questionPairKey = `holistic-q${selectedPoll.poll_index}-q${selectedPoll.poll_index + 1}`;
    const isVisible = showMatrixGraphs[questionPairKey];

    return (
      <div className="mt-6">
        {/* Toggle and Export Buttons */}
        <div className="flex justify-center gap-3 mb-4">
          <button
            onClick={() => toggleMatrixGraph(questionPairKey)}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
          >
            {isVisible ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
                Hide Matrix Graph
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                Show Matrix Graph
              </>
            )}
          </button>
          <button
            onClick={() => {
              const importancePoll = filteredPolls.find(
                (p) =>
                  p.page_path.includes('holistic-protection') &&
                  p.poll_index === selectedPoll.poll_index - 1
              );
              const feasibilityPoll = filteredPolls.find(
                (p) =>
                  p.page_path.includes('holistic-protection') &&
                  p.poll_index === selectedPoll.poll_index
              );
              const q1Text = importancePoll?.question || `Question ${selectedPoll.poll_index}`;
              const q2Text = feasibilityPoll?.question || `Question ${selectedPoll.poll_index + 1}`;
              exportMatrixGraph(
                specificGraph,
                q1Text,
                q2Text,
                `Holistic Protection Q${selectedPoll.poll_index}-Q${selectedPoll.poll_index + 1}`
              );
            }}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-colors duration-200 flex items-center gap-2"
            title="Export matrix graph data to CSV"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Export CSV
          </button>
        </div>

        {/* Matrix Graph - Conditionally Rendered */}
        {isVisible && (
          <div className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4 text-center">
              Holistic Protection
            </h3>
            <div className="flex justify-center">
              <div className="w-full max-w-4xl">
                <PrioritizationMatrixGraph key={specificGraph.title} {...specificGraph} />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
