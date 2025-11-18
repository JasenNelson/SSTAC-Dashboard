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

interface MatrixChartConfig {
  figureNumber: string;
  title: string;
  titleMatch: string;
}

const MATRIX_CHARTS: MatrixChartConfig[] = [
  {
    figureNumber: 'G-19',
    title: 'Matrix Standards (Ecosystem Health - Food-Related)',
    titleMatch: 'Ecosystem Health - Food-Related'
  },
  {
    figureNumber: 'G-20',
    title: 'Matrix Standards (Ecosystem Health - Direct Toxicity)',
    titleMatch: 'Ecosystem Health - Direct Toxicity'
  },
  {
    figureNumber: 'G-21',
    title: 'Matrix Standards (Human Health - Direct Toxicity)',
    titleMatch: 'Human Health - Direct Toxicity'
  },
  {
    figureNumber: 'G-22',
    title: 'Matrix Standards (Human Health - Food-Related)',
    titleMatch: 'Human Health - Food-Related'
  },
  {
    figureNumber: 'G-23',
    title: 'Site-Specific Standards (Bioavailability)',
    titleMatch: 'Site-Specific Standards'
  }
];

export default function CEWMatrixCharts() {
  const [matrixData, setMatrixData] = useState<MatrixData[]>([]);
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
        setMatrixData(data);
      } catch (err) {
        console.error('Error fetching matrix data:', err);
        setError('Failed to load matrix graph data');
      } finally {
        setLoading(false);
      }
    };

    fetchMatrixData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
        {MATRIX_CHARTS.map((chart) => (
          <div key={chart.figureNumber} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Figure {chart.figureNumber}
              </span>
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
        {MATRIX_CHARTS.map((chart) => (
          <div key={chart.figureNumber} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Figure {chart.figureNumber}
              </span>
            </div>
            <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 my-6">
      {MATRIX_CHARTS.map((chart) => {
        // Find matching matrix data
        const data = matrixData.find((item) => 
          item.title.includes(chart.titleMatch)
        );

        if (!data || data.individualPairs.length === 0) {
          return (
            <div key={chart.figureNumber} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="mb-2">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Figure {chart.figureNumber}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 italic">
                Matrix visualization chart will be displayed here. This shows importance vs. feasibility scatter plot for {chart.title}.
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                (No data available yet)
              </p>
            </div>
          );
        }

        return (
          <div key={chart.figureNumber} className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <div className="mb-2">
              <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Figure {chart.figureNumber}
              </span>
            </div>
            <PrioritizationMatrixGraph
              title={chart.title}
              avgImportance={data.avgImportance}
              avgFeasibility={data.avgFeasibility}
              responses={data.responses}
              individualPairs={data.individualPairs}
            />
          </div>
        );
      })}
    </div>
  );
}

