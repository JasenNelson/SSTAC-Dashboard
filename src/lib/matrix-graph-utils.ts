// src/lib/matrix-graph-utils.ts
// Shared utilities for matrix graph visualization components

/**
 * Shared types for matrix graph components
 */
export interface IndividualVotePair {
  userId: string;
  importance: number;
  feasibility: number;
  userType: 'authenticated' | 'cew';
}

export type VisualizationMode = 'jittered' | 'size-scaled' | 'heatmap' | 'concentric';

export interface JitteredPoint {
  pair: IndividualVotePair;
  x: number;
  y: number;
  clusterSize: number;
}

export interface SizeScaledPoint {
  pairs: IndividualVotePair[];
  x: number;
  y: number;
  clusterSize: number;
  radius: number;
}

export interface HeatmapPoint {
  pairs: IndividualVotePair[];
  x: number;
  y: number;
  clusterSize: number;
  intensity: number;
}

export interface ConcentricPoint {
  pairs: IndividualVotePair[];
  x: number;
  y: number;
  clusterSize: number;
}

export interface MatrixGraphColors {
  background: string;
  axis: string;
  text: string;
  textSecondary: string;
  highPriority: string;
  noGo: string;
  averageStar: string;
  averageStarStroke: string;
  individualDot: string;
}

/**
 * Convert scores (1-5) to coordinates within the safe plotting area
 * Note: API sends 1=Very Important, 5=Not Important (inverted scale)
 * We need to invert this so 1 becomes high on the graph (top-right)
 * 
 * @param importance - Importance score (1-5, where 1 is Very Important)
 * @param feasibility - Feasibility score (1-5, where 1 is Very Feasible)
 * @returns Object with x and y coordinates in pixels
 */
export function calculateCoordinates(importance: number, feasibility: number): { x: number; y: number } {
  // Safe area: 120-680 pixels (560px range) to avoid edges and axis overlap
  // Invert feasibility scale: 1 becomes 5, 5 becomes 1 for proper positioning
  const invertedFeasibility = 6 - feasibility; // 1->5, 2->4, 3->3, 4->2, 5->1
  // For importance: 1 (Very Important) should be at top (y=120), 5 (Not Important) at bottom (y=400)
  // So we use importance directly, not inverted
  const x = 120 + ((invertedFeasibility - 1) / 4) * 560; // 120 to 680
  const y = 120 + ((importance - 1) / 4) * 280;   // 120 to 400 (1->120, 5->400)
  
  return { x, y };
}

/**
 * Create clusters for overlapping data points
 * Groups vote pairs by their exact coordinates
 * 
 * @param pairs - Array of individual vote pairs
 * @returns Map of coordinate keys to arrays of vote pairs at that coordinate
 */
export function createDataPointClusters(pairs: IndividualVotePair[]): Map<string, IndividualVotePair[]> {
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
}

/**
 * Jittered visualization - spread overlapping points in a small radius
 * 
 * @param clusters - Map of coordinate keys to arrays of vote pairs
 * @returns Array of jittered points with coordinates
 */
export function createJitteredPoints(clusters: Map<string, IndividualVotePair[]>): JitteredPoint[] {
  const jitteredPoints: JitteredPoint[] = [];
  
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
}

/**
 * Size-scaled visualization - larger dots for more overlapping points
 * 
 * @param clusters - Map of coordinate keys to arrays of vote pairs
 * @returns Array of size-scaled points with radius based on cluster size
 */
export function createSizeScaledPoints(clusters: Map<string, IndividualVotePair[]>): SizeScaledPoint[] {
  return Array.from(clusters.entries()).map(([key, clusterPairs]) => {
    const [x, y] = key.split(',').map(Number);
    const clusterSize = clusterPairs.length;
    
    return {
      pairs: clusterPairs,
      x,
      y,
      clusterSize,
      radius: Math.min(12, 4 + clusterSize * 1.5) // Scale radius with cluster size
    };
  });
}

/**
 * Heatmap visualization - color intensity based on density
 * 
 * @param clusters - Map of coordinate keys to arrays of vote pairs
 * @returns Array of heatmap points with intensity values
 */
export function createHeatmapPoints(clusters: Map<string, IndividualVotePair[]>): HeatmapPoint[] {
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
}

/**
 * Concentric circles visualization - multiple rings for overlapping points
 * 
 * @param clusters - Map of coordinate keys to arrays of vote pairs
 * @returns Array of concentric points
 */
export function createConcentricPoints(clusters: Map<string, IndividualVotePair[]>): ConcentricPoint[] {
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
}

/**
 * Get color scheme based on dark mode
 * 
 * @param isDarkMode - Whether dark mode is active
 * @returns Color scheme object
 */
export function getMatrixGraphColors(isDarkMode: boolean): MatrixGraphColors {
  return {
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
}

/**
 * Get cluster color based on cluster size
 * Uses a blue progression from light to dark
 * 
 * @param clusterSize - Number of points in the cluster
 * @returns Hex color string
 */
export function getClusterColor(clusterSize: number): string {
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
}

