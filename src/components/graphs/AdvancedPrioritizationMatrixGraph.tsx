// src/components/graphs/AdvancedPrioritizationMatrixGraph.tsx
'use client';

import { useState } from 'react';
import {
  type IndividualVotePair,
  type VisualizationMode,
  calculateCoordinates,
  createDataPointClusters,
  createJitteredPoints,
  createSizeScaledPoints,
  createHeatmapPoints,
  createConcentricPoints,
  getMatrixGraphColors
} from '@/lib/matrix-graph-utils';
import { useDarkMode } from '@/hooks/useDarkMode';

interface GraphProps {
  title: string;
  avgImportance: number;
  avgFeasibility: number;
  responses: number;
  individualPairs: IndividualVotePair[];
}

export default function AdvancedPrioritizationMatrixGraph({ 
  title, 
  avgImportance, 
  avgFeasibility, 
  responses, 
  individualPairs 
}: GraphProps) {
  const isDarkMode = useDarkMode();
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('jittered');

  // Convert average scores to coordinates
  const { x: avgX, y: avgY } = calculateCoordinates(avgImportance, avgFeasibility);

  // Color scheme based on theme (using shared utility)
  const colors = getMatrixGraphColors(isDarkMode);

  // Get clusters and render based on visualization mode
  const clusters = createDataPointClusters(individualPairs);

  return (
    <div className="p-3 border rounded-lg shadow-md bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-base font-semibold text-center text-gray-900 dark:text-white flex-1">{title}</h3>
        
        {/* Visualization Mode Selector */}
        <div className="flex gap-1 ml-2">
          {(['jittered', 'size-scaled', 'heatmap', 'concentric'] as VisualizationMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setVisualizationMode(mode)}
              className={`px-2 py-1 text-xs rounded ${
                visualizationMode === mode
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
              title={`Switch to ${mode.replace('-', ' ')} visualization`}
            >
              {mode.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        <svg
          className="w-full h-full rounded-md"
          viewBox="0 0 800 450"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width="800" height="450" fill={colors.background} />
          
          {/* Solid axis lines */}
          <line x1="100" y1="50" x2="100" y2="400" stroke={colors.axis} strokeWidth="4" />
          <line x1="100" y1="400" x2="700" y2="400" stroke={colors.axis} strokeWidth="4" />
          
          {/* Dashed quadrant dividers */}
          <line x1="400" y1="50" x2="400" y2="400" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} strokeWidth="2" strokeDasharray="5,5" />
          <line x1="100" y1="225" x2="700" y2="225" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} strokeWidth="2" strokeDasharray="5,5" />
          
          {/* Y-axis label */}
          <text
            x="50"
            y="225"
            textAnchor="middle"
            dominantBaseline="middle"
            transform="rotate(-90 50 225)"
            fill={colors.axis}
            fontSize="20"
            fontWeight="bold"
          >
            Important
          </text>
          <polygon points="40,60 60,60 50,40" fill={colors.axis} />
          
          {/* X-axis label */}
          <text 
            x="400" 
            y="430" 
            textAnchor="middle" 
            dominantBaseline="middle" 
            fill={colors.axis} 
            fontSize="20" 
            fontWeight="bold"
          >
            Feasible
          </text>
          <polygon points="680,420 680,440 700,430" fill={colors.axis} />
          
          {/* Quadrant labels */}
          <text x="250" y="100" textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize="18" fontWeight="bold">
            LONGER-TERM
          </text>
          <text x="250" y="125" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            Very important but not
          </text>
          <text x="250" y="140" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            currently feasible
          </text>
          
          <text x="550" y="95" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="18" fontWeight="bold">
            HIGH PRIORITY
          </text>
          <text x="550" y="115" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="18" fontWeight="bold">
            NEAR-TERM
          </text>
          <text x="550" y="140" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="14">
            Very important and
          </text>
          <text x="550" y="155" textAnchor="middle" dominantBaseline="middle" fill={colors.highPriority} fontSize="14">
            feasible now
          </text>
          
          <text x="250" y="300" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="18" fontWeight="bold">
            NO GO
          </text>
          <text x="250" y="325" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="14">
            Not currently important
          </text>
          <text x="250" y="340" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="14">
            or feasible
          </text>
          
          <text x="550" y="300" textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize="18" fontWeight="bold">
            POSSIBLY LATER?
          </text>
          <text x="550" y="325" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            Highly feasible but not
          </text>
          <text x="550" y="340" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            currently important
          </text>
          
          {/* Render data points based on visualization mode */}
          {(() => {
            switch (visualizationMode) {
              case 'jittered':
                const jitteredPoints = createJitteredPoints(clusters);
                return jitteredPoints.map((point, index) => (
                  <circle
                    key={`jittered-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.clusterSize > 1 ? 4 : 6}
                    fill={colors.individualDot}
                    opacity={point.clusterSize > 1 ? 0.7 : 0.8}
                    stroke={colors.background}
                    strokeWidth="1"
                  >
                    <title>
                      {point.clusterSize > 1 
                        ? `${point.clusterSize} users at this location | User: ${point.pair.userId.substring(0, 8)}... | Importance: ${point.pair.importance}, Feasibility: ${point.pair.feasibility}`
                        : `User: ${point.pair.userId.substring(0, 8)}... | Importance: ${point.pair.importance}, Feasibility: ${point.pair.feasibility}`
                      }
                    </title>
                  </circle>
                ));

              case 'size-scaled':
                const sizeScaledPoints = createSizeScaledPoints(clusters);
                return sizeScaledPoints.map((point, index) => (
                  <circle
                    key={`size-scaled-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.radius}
                    fill={colors.individualDot}
                    opacity="0.8"
                    stroke={colors.background}
                    strokeWidth="2"
                  >
                    <title>
                      {`${point.clusterSize} users at this location | Importance: ${point.pairs[0].importance}, Feasibility: ${point.pairs[0].feasibility}`}
                    </title>
                  </circle>
                ));

              case 'heatmap':
                const heatmapPoints = createHeatmapPoints(clusters);
                return heatmapPoints.map((point, index) => (
                  <circle
                    key={`heatmap-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r="8"
                    fill={colors.individualDot}
                    opacity={0.3 + point.intensity * 0.7}
                    stroke={colors.background}
                    strokeWidth="1"
                  >
                    <title>
                      {`${point.clusterSize} users at this location | Importance: ${point.pairs[0].importance}, Feasibility: ${point.pairs[0].feasibility}`}
                    </title>
                  </circle>
                ));

              case 'concentric':
                const concentricPoints = createConcentricPoints(clusters);
                return concentricPoints.map((point, index) => (
                  <g key={`concentric-${index}`}>
                    {Array.from({ length: Math.min(point.clusterSize, 3) }, (_, ringIndex) => (
                      <circle
                        key={`concentric-${index}-${ringIndex}`}
                        cx={point.x}
                        cy={point.y}
                        r={6 + ringIndex * 4}
                        fill="none"
                        stroke={colors.individualDot}
                        strokeWidth="2"
                        opacity={0.8 - ringIndex * 0.2}
                      >
                        <title>
                          {`${point.clusterSize} users at this location | Importance: ${point.pairs[0].importance}, Feasibility: ${point.pairs[0].feasibility}`}
                        </title>
                      </circle>
                    ))}
                    {/* Center dot */}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r="4"
                      fill={colors.individualDot}
                      opacity="0.9"
                    />
                  </g>
                ));

              default:
                return null;
            }
          })()}

          {/* Average data point - golden star */}
          {responses > 0 && (
            <g transform={`translate(${avgX}, ${avgY})`}>
              <polygon
                points="0,-12 3.5,-3.5 12,-3.5 5.5,2.5 8.5,12 0,7 -8.5,12 -5.5,2.5 -12,-3.5 -3.5,-3.5"
                fill={colors.averageStar}
                stroke={colors.averageStarStroke}
                strokeWidth="2"
              >
                <title>{`Average: Importance ${avgImportance.toFixed(2)}, Feasibility ${avgFeasibility.toFixed(2)} | Based on ${responses} responses`}</title>
              </polygon>
            </g>
          )}
        </svg>
      </div>

      {/* Description with visualization mode info */}
      <div className="text-center mt-2">
        <p className="text-base text-gray-600 dark:text-gray-300">
          Based on {responses} paired response(s). Showing {individualPairs.length} individual data points.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Mode: {visualizationMode.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} | 
          {(() => {
            const overlappingClusters = Array.from(clusters.values()).filter(c => c.length > 1);
            return overlappingClusters.length > 0 
              ? ` ${overlappingClusters.length} location${overlappingClusters.length > 1 ? 's' : ''} with multiple responses`
              : ' No overlapping data points';
          })()}
        </p>
      </div>
    </div>
  );
}
