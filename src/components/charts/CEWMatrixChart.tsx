'use client';

import { useEffect, useState } from 'react';
import PrioritizationMatrixGraph from '@/components/graphs/PrioritizationMatrixGraph';

interface MatrixData {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
  individualPairs: Array<{
    userId: string;
    importance: number;
    feasibility: number;
    userType: 'authenticated' | 'cew';
  }>;
}

interface CEWMatrixChartProps {
  figureNumber: string;
  titleMatch: string;
  title: string;
}

export default function CEWMatrixChart({ figureNumber, titleMatch, title }: CEWMatrixChartProps) {
  const [matrixData, setMatrixData] = useState<MatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatrixData = async () => {
      try {
        setLoading(true);
        setError(null);
        // Fetch CEW data only
        const response = await fetch('/api/graphs/prioritization-matrix?filter=cew');
        if (!response.ok) {
          throw new Error('Failed to fetch matrix data');
        }
        const data: MatrixData[] = await response.json();
        
        // Find matching matrix data
        const matchedData = data.find((item) => 
          item.title.includes(titleMatch)
        );
        
        if (matchedData) {
          setMatrixData(matchedData);
        } else {
          setMatrixData(null);
        }
      } catch (err) {
        console.error('Error fetching matrix data:', err);
        setError('Failed to load matrix graph data');
      } finally {
        setLoading(false);
      }
    };

    fetchMatrixData();
  }, [titleMatch]);

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6 w-full">
        <div className="mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Figure {figureNumber}
          </span>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6 w-full">
        <div className="mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Figure {figureNumber}
          </span>
        </div>
        <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!matrixData || matrixData.individualPairs.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6 w-full">
        <div className="mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Figure {figureNumber}
          </span>
        </div>
        <p className="text-sm text-gray-700 dark:text-gray-300 italic">
          Matrix visualization chart will be displayed here. This shows importance vs. feasibility scatter plot for {title}.
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          (No data available yet)
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg shadow p-6 my-6 w-full">
      <div className="mb-2">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          Figure {figureNumber}
        </span>
      </div>
      <PrioritizationMatrixGraph
        title={title}
        avgImportance={matrixData.avgImportance}
        avgFeasibility={matrixData.avgFeasibility}
        responses={matrixData.responses}
        individualPairs={matrixData.individualPairs}
      />
    </div>
  );
}

