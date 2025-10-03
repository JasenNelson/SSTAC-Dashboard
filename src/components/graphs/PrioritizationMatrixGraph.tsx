// src/components/graphs/PrioritizationMatrixGraph.tsx
'use client';

import { useEffect, useState } from 'react';
import { ScatterChart, Circle, Zap, Layers } from 'lucide-react';

interface IndividualVotePair {
  userId: string;
  importance: number;
  feasibility: number;
  userType: 'authenticated' | 'cew';
}

interface GraphProps {
  title: string;
  avgImportance: number; // Correctly inverted scale 1-5
  avgFeasibility: number; // Correctly inverted scale 1-5
  responses: number;
  individualPairs: IndividualVotePair[];
}

type VisualizationMode = 'jittered' | 'size-scaled' | 'heatmap' | 'concentric';

export default function PrioritizationMatrixGraph({ title, avgImportance, avgFeasibility, responses, individualPairs }: GraphProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState<VisualizationMode>('jittered');

  // Debug: Log individual pairs received
  console.log(`🎯 Matrix Graph "${title}" received ${individualPairs.length} individual pairs:`, individualPairs);


  useEffect(() => {
    // Check for dark mode
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    // Watch for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  // Helper function to convert scores (1-5) to coordinates within the safe plotting area
  // Note: API sends 1=Very Important, 5=Not Important (inverted scale)
  // We need to invert this so 1 becomes high on the graph (top-right)
  const calculateCoordinates = (importance: number, feasibility: number) => {
    // Safe area: 120-680 pixels (560px range) to avoid edges and axis overlap
    // Invert feasibility scale: 1 becomes 5, 5 becomes 1 for proper positioning
    const invertedFeasibility = 6 - feasibility; // 1->5, 2->4, 3->3, 4->2, 5->1
    // For importance: 1 (Very Important) should be at top (y=120), 5 (Not Important) at bottom (y=400)
    // So we use importance directly, not inverted
    const x = 120 + ((invertedFeasibility - 1) / 4) * 560; // 120 to 680
    const y = 120 + ((importance - 1) / 4) * 280;   // 120 to 400 (1->120, 5->400)
    
    
    return { x, y };
  };

  // Helper function to create clusters for overlapping data points
  const createDataPointClusters = (pairs: IndividualVotePair[]) => {
    const clusters = new Map<string, IndividualVotePair[]>();
    
    // Group pairs by their exact coordinates
    pairs.forEach(pair => {
      const { x, y } = calculateCoordinates(pair.importance, pair.feasibility);
      const key = `${x.toFixed(1)},${y.toFixed(1)}`;
      
      if (!clusters.has(key)) {
        clusters.set(key, []);
      }
      clusters.get(key)!.push(pair);
    });
    
    return clusters;
  };

  // Jittered visualization - spread overlapping points in a small radius
  const createJitteredPoints = (clusters: Map<string, IndividualVotePair[]>) => {
    const jitteredPoints: Array<{
      pair: IndividualVotePair;
      x: number;
      y: number;
      clusterSize: number;
    }> = [];
    
    clusters.forEach((clusterPairs, key) => {
      const [baseX, baseY] = key.split(',').map(Number);
      const clusterSize = clusterPairs.length;
      
      if (clusterSize === 1) {
        jitteredPoints.push({
          pair: clusterPairs[0],
          x: baseX,
          y: baseY,
          clusterSize: 1
        });
      } else {
        const jitterRadius = Math.min(15, clusterSize * 2);
        const angleStep = (2 * Math.PI) / clusterSize;
        
        clusterPairs.forEach((pair, index) => {
          const angle = angleStep * index + (Math.random() - 0.5) * 0.3;
          const distance = Math.random() * jitterRadius * 0.6 + jitterRadius * 0.4;
          
          const jitterX = baseX + Math.cos(angle) * distance;
          const jitterY = baseY + Math.sin(angle) * distance;
          
          jitteredPoints.push({
            pair,
            x: jitterX,
            y: jitterY,
            clusterSize
          });
        });
      }
    });
    
    return jitteredPoints;
  };

  // Size-scaled visualization - larger dots for more overlapping points
  const createSizeScaledPoints = (clusters: Map<string, IndividualVotePair[]>) => {
    return Array.from(clusters.entries()).map(([key, clusterPairs]) => {
      const [x, y] = key.split(',').map(Number);
      const clusterSize = clusterPairs.length;
      
      return {
        pairs: clusterPairs,
        x,
        y,
        clusterSize,
        radius: Math.min(12, 4 + clusterSize * 1.5)
      };
    });
  };

  // Heatmap visualization - color intensity based on density
  const createHeatmapPoints = (clusters: Map<string, IndividualVotePair[]>) => {
    const maxClusterSize = Math.max(...Array.from(clusters.values()).map(c => c.length));
    
    return Array.from(clusters.entries()).map(([key, clusterPairs]) => {
      const [x, y] = key.split(',').map(Number);
      const clusterSize = clusterPairs.length;
      const intensity = clusterSize / maxClusterSize;
      
      return {
        pairs: clusterPairs,
        x,
        y,
        clusterSize,
        intensity
      };
    });
  };

  // Concentric circles visualization - multiple rings for overlapping points
  const createConcentricPoints = (clusters: Map<string, IndividualVotePair[]>) => {
    return Array.from(clusters.entries()).map(([key, clusterPairs]) => {
      const [x, y] = key.split(',').map(Number);
      const clusterSize = clusterPairs.length;
      
      return {
        pairs: clusterPairs,
        x,
        y,
        clusterSize
      };
    });
  };

  // Convert average scores to coordinates
  const { x: avgX, y: avgY } = calculateCoordinates(avgImportance, avgFeasibility);

  // Color scheme based on theme
  const colors = {
    background: isDarkMode ? '#1f2937' : 'white',
    axis: isDarkMode ? '#ffffff' : '#000000',
    text: isDarkMode ? '#ffffff' : '#374151',
    textSecondary: isDarkMode ? '#d1d5db' : '#6b7280',
    highPriority: '#059669', // Green stays the same
    noGo: '#dc2626', // Red stays the same
    averageStar: '#FFD700', // Golden star
    averageStarStroke: '#FFA500', // Darker gold stroke
    individualDot: '#2563eb' // Blue individual dots for better contrast
  };

  // Cluster size-based color scheme (light to dark blue progression)
  const getClusterColor = (clusterSize: number) => {
    if (clusterSize === 1) {
      return '#3b82f6'; // Standard blue - single points (more visible than light blue)
    } else if (clusterSize === 2) {
      return '#2563eb'; // Medium dark blue - 2 points
    } else if (clusterSize === 3) {
      return '#1d4ed8'; // Dark blue - 3 points
    } else if (clusterSize === 4) {
      return '#1e40af'; // Darker blue - 4 points
    } else if (clusterSize === 5) {
      return '#1e3a8a'; // Very dark blue - 5 points
    } else if (clusterSize === 6) {
      return '#312e81'; // Indigo - 6 points
    } else if (clusterSize <= 10) {
      return '#4338ca'; // Dark indigo - 7-10 points
    } else if (clusterSize <= 20) {
      return '#3730a3'; // Deeper indigo - 11-20 points
    } else {
      return '#1e1b4b'; // Darkest indigo - 20+ points
    }
  };

  return (
    <div className="p-3 border rounded-lg shadow-md bg-white dark:bg-gray-800">
      <div className="flex justify-between items-center mb-2 h-10">
        {/* Visualization Mode Selector - Top Left */}
        <div className="flex gap-1">
          <button
            onClick={() => setVisualizationMode('jittered')}
            className={`p-2 rounded-md transition-all ${
              visualizationMode === 'jittered'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Jittered clustering - spread overlapping points"
          >
            <ScatterChart className="w-4 h-4" />
          </button>
          <button
            onClick={() => setVisualizationMode('size-scaled')}
            className={`p-2 rounded-md transition-all ${
              visualizationMode === 'size-scaled'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Size-scaled - larger dots for more overlapping points"
          >
            <Circle className="w-4 h-4" />
          </button>
          <button
            onClick={() => setVisualizationMode('heatmap')}
            className={`p-2 rounded-md transition-all ${
              visualizationMode === 'heatmap'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Heatmap - color intensity shows density"
          >
            <Zap className="w-4 h-4" />
          </button>
          <button
            onClick={() => setVisualizationMode('concentric')}
            className={`p-2 rounded-md transition-all ${
              visualizationMode === 'concentric'
                ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
            title="Concentric circles - rings show overlapping points"
          >
            <Layers className="w-4 h-4" />
          </button>
        </div>

        {/* Title - Centered */}
        <h3 className="text-base font-semibold text-center text-gray-900 dark:text-white flex-1">{title}</h3>
        
        {/* Empty div for spacing */}
        <div className="w-20"></div>
      </div>
      <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
        <svg
          className="w-full h-full rounded-md"
          viewBox="0 0 800 450"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Background */}
          <rect width="800" height="450" fill={colors.background} />
          
          {/* Solid axis lines - positioned to avoid text overlap */}
          <line x1="100" y1="50" x2="100" y2="400" stroke={colors.axis} strokeWidth="4" />
          <line x1="100" y1="400" x2="700" y2="400" stroke={colors.axis} strokeWidth="4" />
          
          {/* Dashed quadrant dividers */}
          <line x1="400" y1="50" x2="400" y2="400" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} strokeWidth="2" strokeDasharray="5,5" />
          <line x1="100" y1="225" x2="700" y2="225" stroke={isDarkMode ? '#4b5563' : '#e5e7eb'} strokeWidth="2" strokeDasharray="5,5" />
          
          {/* Y-axis label (Importance) */}
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
          
          {/* X-axis label (Feasible) */}
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
          
          {/* Quadrant labels - positioned to avoid axis overlap with text wrapping */}
          {/* Top-Left: LONGER-TERM */}
          <text x="250" y="100" textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize="18" fontWeight="bold">
            LONGER-TERM
          </text>
          <text x="250" y="125" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            Very important but not
          </text>
          <text x="250" y="140" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            currently feasible
          </text>
          
          {/* Top-Right: HIGH PRIORITY NEAR-TERM */}
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
          
          {/* Bottom-Left: NO GO */}
          <text x="250" y="300" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="18" fontWeight="bold">
            NO GO
          </text>
          <text x="250" y="325" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="14">
            Not currently important
          </text>
          <text x="250" y="340" textAnchor="middle" dominantBaseline="middle" fill={colors.noGo} fontSize="14">
            or feasible
          </text>
          
          {/* Bottom-Right: POSSIBLY LATER? */}
          <text x="550" y="300" textAnchor="middle" dominantBaseline="middle" fill={colors.text} fontSize="18" fontWeight="bold">
            POSSIBLY LATER?
          </text>
          <text x="550" y="325" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            Highly feasible but not
          </text>
          <text x="550" y="340" textAnchor="middle" dominantBaseline="middle" fill={colors.textSecondary} fontSize="14">
            currently important
          </text>
          
          {/* Individual data points with different visualization modes */}
          {(() => {
            const clusters = createDataPointClusters(individualPairs);
            
            switch (visualizationMode) {
              case 'jittered':
                const jitteredPoints = createJitteredPoints(clusters);
                return jitteredPoints.map((point, index) => {
                  const { pair, x, y, clusterSize } = point;
                  const dotColor = getClusterColor(clusterSize);
                  
                  return (
                    <circle
                      key={`jittered-${index}`}
                      cx={x}
                      cy={y}
                      r={clusterSize > 1 ? 4 : 6}
                      fill={dotColor}
                      opacity={clusterSize > 1 ? 0.7 : 0.8}
                      stroke={colors.background}
                      strokeWidth="1"
                    >
                      <title>
                        {clusterSize > 1 
                          ? `${clusterSize} users at this location | User: ${pair.userId.substring(0, 8)}... | Importance: ${pair.importance}, Feasibility: ${pair.feasibility}`
                          : `User: ${pair.userId.substring(0, 8)}... | Importance: ${pair.importance}, Feasibility: ${pair.feasibility}`
                        }
                      </title>
                    </circle>
                  );
                });

              case 'size-scaled':
                const sizeScaledPoints = createSizeScaledPoints(clusters);
                return sizeScaledPoints.map((point, index) => (
                  <circle
                    key={`size-scaled-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={point.radius}
                    fill={getClusterColor(point.clusterSize)}
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
                    fill={getClusterColor(point.clusterSize)}
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
                        stroke={getClusterColor(point.clusterSize)}
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
                      fill={getClusterColor(point.clusterSize)}
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
      <div className="text-center mt-2">
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {individualPairs.length} votes
        </p>
        
        {/* Color Legend - Spectrum bar */}
        {(() => {
          const clusters = createDataPointClusters(individualPairs);
          const clusterSizes = new Set(Array.from(clusters.values()).map(c => c.length));
          const hasMultipleSizes = clusterSizes.size > 1;
          
          // Debug: Log cluster information
          console.log(`🎨 Color Legend Debug for "${title}":`, {
            totalClusters: clusters.size,
            clusterSizes: Array.from(clusterSizes),
            hasMultipleSizes,
            individualPairs: individualPairs.length
          });
          
          if (hasMultipleSizes) {
            const sortedSizes = Array.from(clusterSizes).sort((a, b) => a - b);
            const minSize = Math.min(...sortedSizes);
            const maxSize = Math.max(...sortedSizes);
            
            return (
              <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-medium">Light = less, Dark = more</span>
                <div className="flex justify-center items-center gap-2 mt-1">
                  <span className="text-xs">{minSize}</span>
                  <div className="flex h-4 w-32 rounded border border-gray-300 dark:border-gray-600 overflow-hidden">
                    {Array.from({ length: 20 }, (_, i) => {
                      const normalizedValue = i / 19;
                      const interpolatedSize = minSize + (maxSize - minSize) * normalizedValue;
                      return (
                        <div
                          key={i}
                          className="flex-1 h-full"
                          style={{ backgroundColor: getClusterColor(Math.round(interpolatedSize)) }}
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs">{maxSize}</span>
                </div>
              </div>
            );
          } else {
            // Don't show anything when all points are the same size
            return null;
          }
        })()}
      </div>
    </div>
  );
}
