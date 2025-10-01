// src/components/graphs/MatrixGraphDemo.tsx
'use client';

import { useState } from 'react';
import PrioritizationMatrixGraph from './PrioritizationMatrixGraph';
import AdvancedPrioritizationMatrixGraph from './AdvancedPrioritizationMatrixGraph';

// Demo data with overlapping points
const demoData = {
  title: "Demo Matrix Standards (Human Health - Food-Related)",
  avgImportance: 2.3,
  avgFeasibility: 2.8,
  responses: 25,
  individualPairs: [
    // Cluster 1: 8 identical responses (Importance=1, Feasibility=1) - Very Dark Blue
    { userId: 'user-1', importance: 1, feasibility: 1, userType: 'cew' as const },
    { userId: 'user-2', importance: 1, feasibility: 1, userType: 'cew' as const },
    { userId: 'user-3', importance: 1, feasibility: 1, userType: 'cew' as const },
    { userId: 'user-4', importance: 1, feasibility: 1, userType: 'authenticated' as const },
    { userId: 'user-5', importance: 1, feasibility: 1, userType: 'authenticated' as const },
    { userId: 'user-6', importance: 1, feasibility: 1, userType: 'cew' as const },
    { userId: 'user-7', importance: 1, feasibility: 1, userType: 'authenticated' as const },
    { userId: 'user-8', importance: 1, feasibility: 1, userType: 'cew' as const },
    
    // Cluster 2: 6 identical responses (Importance=2, Feasibility=2) - Darker Blue
    { userId: 'user-9', importance: 2, feasibility: 2, userType: 'cew' as const },
    { userId: 'user-10', importance: 2, feasibility: 2, userType: 'cew' as const },
    { userId: 'user-11', importance: 2, feasibility: 2, userType: 'authenticated' as const },
    { userId: 'user-12', importance: 2, feasibility: 2, userType: 'cew' as const },
    { userId: 'user-13', importance: 2, feasibility: 2, userType: 'authenticated' as const },
    { userId: 'user-14', importance: 2, feasibility: 2, userType: 'cew' as const },
    
    // Cluster 3: 4 identical responses (Importance=3, Feasibility=3) - Medium Dark Blue
    { userId: 'user-15', importance: 3, feasibility: 3, userType: 'cew' as const },
    { userId: 'user-16', importance: 3, feasibility: 3, userType: 'authenticated' as const },
    { userId: 'user-17', importance: 3, feasibility: 3, userType: 'cew' as const },
    { userId: 'user-18', importance: 3, feasibility: 3, userType: 'authenticated' as const },
    
    // Individual points (no overlap)
    { userId: 'user-11', importance: 1, feasibility: 3, userType: 'cew' as const },
    { userId: 'user-12', importance: 2, feasibility: 1, userType: 'authenticated' as const },
    { userId: 'user-13', importance: 3, feasibility: 1, userType: 'cew' as const },
    { userId: 'user-14', importance: 4, feasibility: 2, userType: 'authenticated' as const },
    { userId: 'user-15', importance: 2, feasibility: 4, userType: 'cew' as const },
    { userId: 'user-16', importance: 3, feasibility: 4, userType: 'authenticated' as const },
    { userId: 'user-17', importance: 4, feasibility: 3, userType: 'cew' as const },
    { userId: 'user-18', importance: 5, feasibility: 2, userType: 'authenticated' as const },
    { userId: 'user-19', importance: 1, feasibility: 5, userType: 'cew' as const },
    { userId: 'user-20', importance: 5, feasibility: 1, userType: 'authenticated' as const },
    
    // Additional overlapping points for demonstration
    { userId: 'user-21', importance: 1, feasibility: 1, userType: 'cew' as const }, // Should add to Cluster 1
    { userId: 'user-22', importance: 2, feasibility: 2, userType: 'authenticated' as const }, // Should add to Cluster 2
    { userId: 'user-23', importance: 2, feasibility: 2, userType: 'cew' as const }, // Should add to Cluster 2
    { userId: 'user-24', importance: 3, feasibility: 3, userType: 'authenticated' as const }, // Should add to Cluster 3
    { userId: 'user-25', importance: 1, feasibility: 1, userType: 'cew' as const }, // Should add to Cluster 1
  ]
};

export default function MatrixGraphDemo() {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Matrix Graph Overlapping Data Points Demo
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          This demo shows how overlapping data points are visualized when multiple users submit identical importance and feasibility ratings.
        </p>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-4">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">Demo Data with Color Spectrum:</h3>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
            <li>• <strong>Cluster 1:</strong> 8 users at Importance=1, Feasibility=1 - <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">Dark Indigo</span> (7-10 points)</li>
            <li>• <strong>Cluster 2:</strong> 6 users at Importance=2, Feasibility=2 - <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">Indigo</span> (6 points)</li>
            <li>• <strong>Cluster 3:</strong> 4 users at Importance=3, Feasibility=3 - <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">Darker Blue</span> (4 points)</li>
            <li>• <strong>Individual points:</strong> Multiple users with unique coordinates - <span className="font-mono text-xs bg-gray-200 dark:bg-gray-700 px-1 rounded">Standard Blue</span> (1 point each)</li>
          </ul>
          <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
            <strong>Color Legend:</strong> Standard Blue (1) → Medium Dark (2) → Dark (3) → Darker (4) → Very Dark (5) → Indigo (6) → Dark Indigo (7-10) → Deeper Indigo (11-20) → Darkest Indigo (20+)
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setShowAdvanced(false)}
            className={`px-4 py-2 rounded-lg font-medium ${
              !showAdvanced
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Hybrid Component (Icon-based mode switching)
          </button>
          <button
            onClick={() => setShowAdvanced(true)}
            className={`px-4 py-2 rounded-lg font-medium ${
              showAdvanced
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Advanced Multi-Mode (Text-based)
          </button>
        </div>
      </div>

      {showAdvanced ? (
        <AdvancedPrioritizationMatrixGraph {...demoData} />
      ) : (
        <PrioritizationMatrixGraph {...demoData} />
      )}

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">How to Use:</h3>
        <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <li>• <strong>Hover over dots</strong> to see individual user information and cluster sizes</li>
          <li>• <strong>Jittered mode:</strong> Overlapping points are spread in a small radius around the original location</li>
          <li>• <strong>Advanced mode:</strong> Switch between 4 visualization approaches using the buttons above the graph</li>
          <li>• <strong>Cluster indicators:</strong> Dashed circles show locations with 3+ overlapping points</li>
          <li>• <strong>Statistics:</strong> The description shows how many locations have multiple responses</li>
        </ul>
      </div>

      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <h3 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-2">Integration Notes:</h3>
        <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
          <li>• The basic component automatically handles overlapping points with jittered clustering</li>
          <li>• The advanced component provides mode switching for different visualization preferences</li>
          <li>• Both components work with the existing API endpoint without changes</li>
          <li>• The clustering algorithm groups points by coordinate precision (0.1 pixel accuracy)</li>
          <li>• Performance is optimized for typical use cases (up to 1000 individual points)</li>
        </ul>
      </div>
    </div>
  );
}
