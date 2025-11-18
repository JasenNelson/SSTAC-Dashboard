import { describe, it, expect } from 'vitest';
import {
  calculateCoordinates,
  createDataPointClusters,
  createJitteredPoints,
  createSizeScaledPoints,
  createHeatmapPoints,
  createConcentricPoints,
  getMatrixGraphColors,
  getClusterColor,
  type IndividualVotePair,
} from '../matrix-graph-utils';

describe('matrix-graph-utils', () => {
  describe('calculateCoordinates', () => {
    it('should calculate coordinates for minimum values (1, 1)', () => {
      const result = calculateCoordinates(1, 1);
      // Importance 1 (Very Important) -> y = 120 (top)
      // Feasibility 1 (Very Feasible) -> inverted to 5 -> x = 680 (right)
      expect(result.x).toBe(680);
      expect(result.y).toBe(120);
    });

    it('should calculate coordinates for maximum values (5, 5)', () => {
      const result = calculateCoordinates(5, 5);
      // Importance 5 (Not Important) -> y = 400 (bottom)
      // Feasibility 5 (Not Feasible) -> inverted to 1 -> x = 120 (left)
      expect(result.x).toBe(120);
      expect(result.y).toBe(400);
    });

    it('should calculate coordinates for middle values (3, 3)', () => {
      const result = calculateCoordinates(3, 3);
      // Importance 3 -> y = 260 (middle)
      // Feasibility 3 -> inverted to 3 -> x = 400 (middle)
      expect(result.x).toBe(400);
      expect(result.y).toBe(260);
    });

    it('should handle edge cases correctly', () => {
      // Test all corner cases
      const topLeft = calculateCoordinates(1, 5); // Very Important, Not Feasible
      expect(topLeft.x).toBe(120);
      expect(topLeft.y).toBe(120);

      const topRight = calculateCoordinates(1, 1); // Very Important, Very Feasible
      expect(topRight.x).toBe(680);
      expect(topRight.y).toBe(120);

      const bottomLeft = calculateCoordinates(5, 5); // Not Important, Not Feasible
      expect(bottomLeft.x).toBe(120);
      expect(bottomLeft.y).toBe(400);

      const bottomRight = calculateCoordinates(5, 1); // Not Important, Very Feasible
      expect(bottomRight.x).toBe(680);
      expect(bottomRight.y).toBe(400);
    });

    it('should return coordinates within safe plotting area', () => {
      for (let importance = 1; importance <= 5; importance++) {
        for (let feasibility = 1; feasibility <= 5; feasibility++) {
          const { x, y } = calculateCoordinates(importance, feasibility);
          expect(x).toBeGreaterThanOrEqual(120);
          expect(x).toBeLessThanOrEqual(680);
          expect(y).toBeGreaterThanOrEqual(120);
          expect(y).toBeLessThanOrEqual(400);
        }
      }
    });
  });

  describe('createDataPointClusters', () => {
    it('should create clusters for non-overlapping points', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 1, feasibility: 1, userType: 'authenticated' },
        { userId: '2', importance: 5, feasibility: 5, userType: 'authenticated' },
      ];

      const clusters = createDataPointClusters(pairs);
      expect(clusters.size).toBe(2);
    });

    it('should group overlapping points into single cluster', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 3, feasibility: 3, userType: 'authenticated' },
        { userId: '2', importance: 3, feasibility: 3, userType: 'cew' },
        { userId: '3', importance: 3, feasibility: 3, userType: 'authenticated' },
      ];

      const clusters = createDataPointClusters(pairs);
      expect(clusters.size).toBe(1);
      const cluster = Array.from(clusters.values())[0];
      expect(cluster.length).toBe(3);
    });

    it('should handle empty array', () => {
      const clusters = createDataPointClusters([]);
      expect(clusters.size).toBe(0);
    });

    it('should handle single point', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 2, feasibility: 4, userType: 'authenticated' },
      ];

      const clusters = createDataPointClusters(pairs);
      expect(clusters.size).toBe(1);
      const cluster = Array.from(clusters.values())[0];
      expect(cluster.length).toBe(1);
      expect(cluster[0].userId).toBe('1');
    });
  });

  describe('createJitteredPoints', () => {
    it('should return single point unchanged for cluster of size 1', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 3, feasibility: 3, userType: 'authenticated' },
      ];
      const clusters = createDataPointClusters(pairs);
      const jittered = createJitteredPoints(clusters);

      expect(jittered.length).toBe(1);
      expect(jittered[0].clusterSize).toBe(1);
      expect(jittered[0].pair.userId).toBe('1');
    });

    it('should spread multiple points in cluster', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 3, feasibility: 3, userType: 'authenticated' },
        { userId: '2', importance: 3, feasibility: 3, userType: 'cew' },
        { userId: '3', importance: 3, feasibility: 3, userType: 'authenticated' },
      ];
      const clusters = createDataPointClusters(pairs);
      const jittered = createJitteredPoints(clusters);

      expect(jittered.length).toBe(3);
      expect(jittered[0].clusterSize).toBe(3);
      // All points should have different coordinates (jittered)
      const xCoords = jittered.map(p => p.x);
      const yCoords = jittered.map(p => p.y);
      const uniqueX = new Set(xCoords.map(x => x.toFixed(1)));
      const uniqueY = new Set(yCoords.map(y => y.toFixed(1)));
      // Points should be spread (at least some variation)
      expect(uniqueX.size).toBeGreaterThan(1);
      expect(uniqueY.size).toBeGreaterThan(1);
    });

    it('should handle empty clusters', () => {
      const clusters = new Map<string, IndividualVotePair[]>();
      const jittered = createJitteredPoints(clusters);
      expect(jittered.length).toBe(0);
    });
  });

  describe('createSizeScaledPoints', () => {
    it('should create size-scaled points with correct radius', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 3, feasibility: 3, userType: 'authenticated' },
        { userId: '2', importance: 3, feasibility: 3, userType: 'cew' },
      ];
      const clusters = createDataPointClusters(pairs);
      const scaled = createSizeScaledPoints(clusters);

      expect(scaled.length).toBe(1);
      expect(scaled[0].clusterSize).toBe(2);
      expect(scaled[0].radius).toBeGreaterThan(4); // Should scale with cluster size
      expect(scaled[0].radius).toBeLessThanOrEqual(12); // Max radius
    });

    it('should cap radius at maximum value', () => {
      // Create a large cluster
      const pairs: IndividualVotePair[] = Array.from({ length: 20 }, (_, i) => ({
        userId: `user-${i}`,
        importance: 3,
        feasibility: 3,
        userType: 'authenticated' as const,
      }));
      const clusters = createDataPointClusters(pairs);
      const scaled = createSizeScaledPoints(clusters);

      expect(scaled[0].radius).toBeLessThanOrEqual(12);
    });

    it('should handle empty clusters', () => {
      const clusters = new Map<string, IndividualVotePair[]>();
      const scaled = createSizeScaledPoints(clusters);
      expect(scaled.length).toBe(0);
    });
  });

  describe('createHeatmapPoints', () => {
    it('should calculate intensity based on cluster size', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 3, feasibility: 3, userType: 'authenticated' },
        { userId: '2', importance: 3, feasibility: 3, userType: 'cew' },
        { userId: '3', importance: 5, feasibility: 5, userType: 'authenticated' },
      ];
      const clusters = createDataPointClusters(pairs);
      const heatmap = createHeatmapPoints(clusters);

      // Should have 2 clusters: one with 2 points, one with 1 point
      expect(heatmap.length).toBe(2);
      const largerCluster = heatmap.find(p => p.clusterSize === 2);
      const smallerCluster = heatmap.find(p => p.clusterSize === 1);
      
      expect(largerCluster?.intensity).toBeGreaterThan(smallerCluster?.intensity || 0);
      expect(largerCluster?.intensity).toBe(1.0); // Max intensity
    });

    it('should handle empty clusters', () => {
      const clusters = new Map<string, IndividualVotePair[]>();
      const heatmap = createHeatmapPoints(clusters);
      expect(heatmap.length).toBe(0);
    });

    it('should handle single cluster', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 3, feasibility: 3, userType: 'authenticated' },
      ];
      const clusters = createDataPointClusters(pairs);
      const heatmap = createHeatmapPoints(clusters);

      expect(heatmap.length).toBe(1);
      expect(heatmap[0].intensity).toBe(1.0); // Single cluster has max intensity
    });
  });

  describe('createConcentricPoints', () => {
    it('should create concentric points with cluster size', () => {
      const pairs: IndividualVotePair[] = [
        { userId: '1', importance: 3, feasibility: 3, userType: 'authenticated' },
        { userId: '2', importance: 3, feasibility: 3, userType: 'cew' },
      ];
      const clusters = createDataPointClusters(pairs);
      const concentric = createConcentricPoints(clusters);

      expect(concentric.length).toBe(1);
      expect(concentric[0].clusterSize).toBe(2);
      expect(concentric[0].pairs.length).toBe(2);
    });

    it('should handle empty clusters', () => {
      const clusters = new Map<string, IndividualVotePair[]>();
      const concentric = createConcentricPoints(clusters);
      expect(concentric.length).toBe(0);
    });
  });

  describe('getMatrixGraphColors', () => {
    it('should return light mode colors when isDarkMode is false', () => {
      const colors = getMatrixGraphColors(false);
      expect(colors.background).toBe('white');
      expect(colors.axis).toBe('#000000');
      expect(colors.text).toBe('#374151');
      expect(colors.highPriority).toBe('#059669');
      expect(colors.noGo).toBe('#dc2626');
    });

    it('should return dark mode colors when isDarkMode is true', () => {
      const colors = getMatrixGraphColors(true);
      expect(colors.background).toBe('#1f2937');
      expect(colors.axis).toBe('#ffffff');
      expect(colors.text).toBe('#ffffff');
      expect(colors.highPriority).toBe('#059669');
      expect(colors.noGo).toBe('#dc2626');
    });

    it('should return consistent theme-independent colors', () => {
      const lightColors = getMatrixGraphColors(false);
      const darkColors = getMatrixGraphColors(true);

      // These colors should be the same in both modes
      expect(lightColors.highPriority).toBe(darkColors.highPriority);
      expect(lightColors.noGo).toBe(darkColors.noGo);
      expect(lightColors.averageStar).toBe(darkColors.averageStar);
      expect(lightColors.averageStarStroke).toBe(darkColors.averageStarStroke);
      expect(lightColors.individualDot).toBe(darkColors.individualDot);
    });
  });

  describe('getClusterColor', () => {
    it('should return correct color for cluster size 1', () => {
      expect(getClusterColor(1)).toBe('#3b82f6');
    });

    it('should return correct color for cluster size 2', () => {
      expect(getClusterColor(2)).toBe('#2563eb');
    });

    it('should return correct color for cluster size 3', () => {
      expect(getClusterColor(3)).toBe('#1d4ed8');
    });

    it('should return correct color for cluster size 4', () => {
      expect(getClusterColor(4)).toBe('#1e40af');
    });

    it('should return correct color for cluster size 5', () => {
      expect(getClusterColor(5)).toBe('#1e3a8a');
    });

    it('should return correct color for cluster size 6', () => {
      expect(getClusterColor(6)).toBe('#312e81');
    });

    it('should return correct color for cluster size 7-10', () => {
      expect(getClusterColor(7)).toBe('#4338ca');
      expect(getClusterColor(10)).toBe('#4338ca');
    });

    it('should return correct color for cluster size 11-20', () => {
      expect(getClusterColor(11)).toBe('#3730a3');
      expect(getClusterColor(20)).toBe('#3730a3');
    });

    it('should return correct color for cluster size 20+', () => {
      expect(getClusterColor(21)).toBe('#1e1b4b');
      expect(getClusterColor(100)).toBe('#1e1b4b');
    });

    it('should return progressively darker colors for larger clusters', () => {
      const color1 = getClusterColor(1);
      const color5 = getClusterColor(5);
      const color10 = getClusterColor(10);
      const color20 = getClusterColor(20);

      // All should be different (darker as size increases)
      expect(color1).not.toBe(color5);
      expect(color5).not.toBe(color10);
      expect(color10).not.toBe(color20);
    });
  });
});

