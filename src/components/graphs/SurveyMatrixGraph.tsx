'use client';

import { useEffect, useState } from 'react';
import { BarChart3, ChevronDown, ChevronUp } from 'lucide-react';
import PrioritizationMatrixGraph from './PrioritizationMatrixGraph';

interface IndividualVotePair {
  userId: string;
  importance: number;
  feasibility: number;
  userType: 'authenticated' | 'cew';
}

interface MatrixData {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
  individualPairs: IndividualVotePair[];
}

interface SurveyMatrixGraphProps {
  questionPair: {
    importanceQuestion: string;
    feasibilityQuestion: string;
    title: string;
  };
  pagePath: 'holistic-protection' | 'prioritization';
  importanceIndex: number;
  feasibilityIndex: number;
}

export default function SurveyMatrixGraph({ 
  questionPair, 
  pagePath, 
  importanceIndex, 
  feasibilityIndex 
}: SurveyMatrixGraphProps) {
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const fetchMatrixData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/graphs/prioritization-matrix?filter=all');
      if (!response.ok) {
        throw new Error('Failed to fetch matrix data');
      }
      
      const data: MatrixData[] = await response.json();
      
      // Find the matrix data for this specific question pair
      const relevantData = data.find(item => 
        item.title.includes(questionPair.title) || 
        (pagePath === 'holistic-protection' && item.title.includes('Matrix Standards')) ||
        (pagePath === 'prioritization' && item.title.includes('Site-Specific Standards'))
      );
      
      if (relevantData) {
        setMatrixData(relevantData);
      } else {
        console.warn('No matrix data found for:', questionPair.title);
        setMatrixData(null);
      }
    } catch (err) {
      console.error('Error fetching matrix data:', err);
      setError('Failed to load matrix graph data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isExpanded && !matrixData) {
      fetchMatrixData();
    }
  }, [isExpanded, matrixData]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="mt-4 border rounded-lg bg-gray-50 dark:bg-gray-800">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center gap-3">
          <BarChart3 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-900 dark:text-white">
            View Matrix Graph: {questionPair.title}
          </span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>
      
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600 dark:text-gray-400">Loading matrix graph...</span>
            </div>
          )}
          
          {error && (
            <div className="text-center py-8">
              <p className="text-red-600 dark:text-red-400 mb-2">{error}</p>
              <button
                onClick={fetchMatrixData}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}
          
          {matrixData && !loading && !error && (
            <div className="space-y-4">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p><strong>Importance Question:</strong> {questionPair.importanceQuestion}</p>
                <p><strong>Feasibility Question:</strong> {questionPair.feasibilityQuestion}</p>
              </div>
              
              <PrioritizationMatrixGraph
                title={matrixData.title}
                avgImportance={matrixData.avgImportance}
                avgFeasibility={matrixData.avgFeasibility}
                responses={matrixData.responses}
                individualPairs={matrixData.individualPairs}
              />
            </div>
          )}
          
          {!matrixData && !loading && !error && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <p>No matrix graph data available for this question pair.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
