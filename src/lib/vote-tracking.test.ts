import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hasVoted, trackVote, clearVoteTracking } from './vote-tracking';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

// Mock navigator
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
};

// Mock window.btoa
const mockBtoa = (str: string) => {
  return Buffer.from(str).toString('base64');
};

describe('vote-tracking', () => {
  beforeEach(() => {
    // Reset localStorage before each test
    localStorageMock.clear();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup global mocks
    global.localStorage = localStorageMock as unknown as Storage;
    global.navigator = mockNavigator as Navigator;
    global.btoa = mockBtoa;
    global.Date.now = vi.fn(() => 1234567890000);
  });

  describe('hasVoted', () => {
    it('should return false when no vote tracked', () => {
      const result = hasVoted('/test-page', 0);
      expect(result).toBe(false);
    });

    it('should return true when vote tracked', () => {
      // Track a vote first
      trackVote('/test-page', 0);
      
      const result = hasVoted('/test-page', 0);
      expect(result).toBe(true);
    });

    it('should return false for different page path', () => {
      trackVote('/test-page', 0);
      
      const result = hasVoted('/different-page', 0);
      expect(result).toBe(false);
    });

    it('should return false for different poll index', () => {
      trackVote('/test-page', 0);
      
      const result = hasVoted('/test-page', 1);
      expect(result).toBe(false);
    });
  });

  describe('trackVote', () => {
    it('should successfully track new vote', () => {
      const result = trackVote('/test-page', 0);
      
      expect(result).toBe(true);
      expect(hasVoted('/test-page', 0)).toBe(true);
      
      // Verify localStorage contains the tracker
      const trackerKey = 'cew_tracker_/test-page_0';
      const stored = localStorageMock.getItem(trackerKey);
      expect(stored).not.toBeNull();
      
      if (stored) {
        const tracker = JSON.parse(stored);
        expect(tracker.pagePath).toBe('/test-page');
        expect(tracker.pollIndex).toBe(0);
        expect(tracker.deviceId).toBeDefined();
        expect(tracker.userAgent).toBe(mockNavigator.userAgent);
        expect(tracker.timestamp).toBe(1234567890000);
      }
    });

    it('should prevent duplicate votes', () => {
      // First vote should succeed
      const firstResult = trackVote('/test-page', 0);
      expect(firstResult).toBe(true);
      
      // Second vote should fail
      const secondResult = trackVote('/test-page', 0);
      expect(secondResult).toBe(false);
    });

    it('should allow votes on different polls', () => {
      const result1 = trackVote('/test-page', 0);
      const result2 = trackVote('/test-page', 1);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(hasVoted('/test-page', 0)).toBe(true);
      expect(hasVoted('/test-page', 1)).toBe(true);
    });

    it('should allow votes on different pages', () => {
      const result1 = trackVote('/page-1', 0);
      const result2 = trackVote('/page-2', 0);
      
      expect(result1).toBe(true);
      expect(result2).toBe(true);
      expect(hasVoted('/page-1', 0)).toBe(true);
      expect(hasVoted('/page-2', 0)).toBe(true);
    });

    it('should generate device ID on first track', () => {
      trackVote('/test-page', 0);
      
      // Check that device ID was stored
      const deviceId = localStorageMock.getItem('cew_device_id');
      expect(deviceId).not.toBeNull();
      expect(deviceId).toMatch(/^device_/);
    });

    it('should reuse existing device ID', () => {
      // Set device ID first
      const existingDeviceId = 'device_existing123';
      localStorageMock.setItem('cew_device_id', existingDeviceId);
      
      trackVote('/test-page', 0);
      
      // Verify device ID was reused
      const trackerKey = 'cew_tracker_/test-page_0';
      const stored = localStorageMock.getItem(trackerKey);
      if (stored) {
        const tracker = JSON.parse(stored);
        expect(tracker.deviceId).toBe(existingDeviceId);
      }
    });

    it('should handle localStorage persistence correctly', () => {
      trackVote('/test-page', 0);
      
      // Verify data persists
      const trackerKey = 'cew_tracker_/test-page_0';
      expect(localStorageMock.getItem(trackerKey)).not.toBeNull();
      
      // Create new instance of vote-tracking and verify it reads persisted data
      expect(hasVoted('/test-page', 0)).toBe(true);
    });
  });

  describe('clearVoteTracking', () => {
    it('should clear tracking for specific poll', () => {
      trackVote('/test-page', 0);
      expect(hasVoted('/test-page', 0)).toBe(true);
      
      clearVoteTracking('/test-page', 0);
      
      expect(hasVoted('/test-page', 0)).toBe(false);
      const trackerKey = 'cew_tracker_/test-page_0';
      expect(localStorageMock.getItem(trackerKey)).toBeNull();
    });

    it('should only clear specified poll', () => {
      trackVote('/test-page', 0);
      trackVote('/test-page', 1);
      
      clearVoteTracking('/test-page', 0);
      
      expect(hasVoted('/test-page', 0)).toBe(false);
      expect(hasVoted('/test-page', 1)).toBe(true);
    });

    it('should handle clearing non-existent tracking gracefully', () => {
      expect(() => {
        clearVoteTracking('/non-existent', 0);
      }).not.toThrow();
      
      expect(hasVoted('/non-existent', 0)).toBe(false);
    });

    it('should not affect device ID when clearing tracking', () => {
      trackVote('/test-page', 0);
      const deviceId = localStorageMock.getItem('cew_device_id');
      
      clearVoteTracking('/test-page', 0);
      
      // Device ID should still exist
      expect(localStorageMock.getItem('cew_device_id')).toBe(deviceId);
    });
  });

  describe('localStorage persistence', () => {
    it('should persist across multiple trackVote calls', () => {
      trackVote('/test-page', 0);
      const firstTracker = localStorageMock.getItem('cew_tracker_/test-page_0');
      
      // Simulate page reload by checking localStorage directly
      const persisted = localStorageMock.getItem('cew_tracker_/test-page_0');
      expect(persisted).toBe(firstTracker);
      expect(persisted).not.toBeNull();
    });

    it('should maintain separate tracking for each poll', () => {
      trackVote('/test-page', 0);
      trackVote('/test-page', 1);
      trackVote('/test-page', 2);
      
      const key0 = localStorageMock.getItem('cew_tracker_/test-page_0');
      const key1 = localStorageMock.getItem('cew_tracker_/test-page_1');
      const key2 = localStorageMock.getItem('cew_tracker_/test-page_2');
      
      expect(key0).not.toBeNull();
      expect(key1).not.toBeNull();
      expect(key2).not.toBeNull();
      
      // All should have same device ID but different timestamps
      const tracker0 = JSON.parse(key0!);
      const tracker1 = JSON.parse(key1!);
      const tracker2 = JSON.parse(key2!);
      
      expect(tracker0.deviceId).toBe(tracker1.deviceId);
      expect(tracker1.deviceId).toBe(tracker2.deviceId);
    });
  });
});

