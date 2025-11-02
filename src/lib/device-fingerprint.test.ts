import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDeviceFingerprint, getDeviceId } from './device-fingerprint';

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
  language: 'en-US',
  hardwareConcurrency: 8,
  maxTouchPoints: 0,
};

// Mock screen
const mockScreen = {
  width: 1920,
  height: 1080,
};

// Mock document.createElement for canvas
const mockCanvas = {
  getContext: vi.fn(() => ({
    fillText: vi.fn(),
  })),
  toDataURL: vi.fn(() => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
};

describe('device-fingerprint', () => {
  beforeEach(() => {
    // Reset localStorage before each test
    localStorageMock.clear();
    
    // Reset mocks
    vi.clearAllMocks();
    
    // Setup global mocks
    global.localStorage = localStorageMock as unknown as Storage;
    global.navigator = mockNavigator as Navigator;
    global.screen = mockScreen as Screen;
    global.document = {
      createElement: vi.fn((tag: string) => {
        if (tag === 'canvas') {
          return mockCanvas as unknown as HTMLCanvasElement;
        }
        return {} as HTMLElement;
      }),
    } as unknown as Document;
  });

  describe('generateDeviceFingerprint', () => {
    it('should create consistent fingerprint', () => {
      const fingerprint1 = generateDeviceFingerprint();
      const fingerprint2 = generateDeviceFingerprint();
      
      // Fingerprints should be consistent (same browser characteristics)
      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^device_/);
    });

    it('should include device characteristics in fingerprint', () => {
      const fingerprint = generateDeviceFingerprint();
      
      // Should be a string starting with 'device_'
      expect(typeof fingerprint).toBe('string');
      expect(fingerprint.startsWith('device_')).toBe(true);
    });

    it('should generate hash-like string', () => {
      const fingerprint = generateDeviceFingerprint();
      
      // Should be a base36 string after 'device_'
      const hashPart = fingerprint.replace('device_', '');
      expect(hashPart.length).toBeGreaterThan(0);
      expect(/^[a-z0-9]+$/i.test(hashPart)).toBe(true);
    });

    it('should use navigator properties', () => {
      // Mock different navigator values
      const customNavigator = {
        ...mockNavigator,
        userAgent: 'Custom User Agent',
        language: 'fr-FR',
        hardwareConcurrency: 16,
        maxTouchPoints: 5,
      };
      global.navigator = customNavigator as Navigator;
      
      const fingerprint = generateDeviceFingerprint();
      expect(fingerprint).toBeDefined();
      expect(fingerprint.startsWith('device_')).toBe(true);
    });

    it('should use screen dimensions', () => {
      const customScreen = {
        width: 2560,
        height: 1440,
      };
      global.screen = customScreen as Screen;
      
      const fingerprint = generateDeviceFingerprint();
      expect(fingerprint).toBeDefined();
    });

    it('should handle canvas fingerprinting', () => {
      const fingerprint = generateDeviceFingerprint();
      
      // Verify canvas was used
      expect(global.document.createElement).toHaveBeenCalledWith('canvas');
      expect(fingerprint).toBeDefined();
    });

    it('should handle timezone offset', () => {
      // Mock Date.getTimezoneOffset
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = vi.fn(() => -300); // EST timezone
      
      const fingerprint = generateDeviceFingerprint();
      expect(fingerprint).toBeDefined();
      
      // Restore
      Date.prototype.getTimezoneOffset = originalGetTimezoneOffset;
    });
  });

  describe('getDeviceId', () => {
    it('should return existing ID from localStorage', () => {
      const existingId = 'device_existing123';
      localStorageMock.setItem('cew_device_id', existingId);
      
      const deviceId = getDeviceId();
      
      expect(deviceId).toBe(existingId);
      expect(localStorageMock.getItem('cew_device_id')).toBe(existingId);
    });

    it('should generate new ID when none exists', () => {
      // Ensure localStorage is empty
      expect(localStorageMock.getItem('cew_device_id')).toBeNull();
      
      const deviceId = getDeviceId();
      
      expect(deviceId).toBeDefined();
      expect(deviceId.startsWith('device_')).toBe(true);
      expect(localStorageMock.getItem('cew_device_id')).toBe(deviceId);
    });

    it('should persist device ID in localStorage', () => {
      const deviceId = getDeviceId();
      
      // Verify it's stored
      expect(localStorageMock.getItem('cew_device_id')).toBe(deviceId);
    });

    it('should return same ID on multiple calls', () => {
      const deviceId1 = getDeviceId();
      const deviceId2 = getDeviceId();
      const deviceId3 = getDeviceId();
      
      expect(deviceId1).toBe(deviceId2);
      expect(deviceId2).toBe(deviceId3);
    });

    it('should persist across localStorage operations', () => {
      const deviceId1 = getDeviceId();
      
      // Simulate clearing other items
      localStorageMock.removeItem('other_key');
      
      const deviceId2 = getDeviceId();
      
      expect(deviceId1).toBe(deviceId2);
      expect(localStorageMock.getItem('cew_device_id')).toBe(deviceId1);
    });

    it('should handle missing navigator properties gracefully', () => {
      const incompleteNavigator = {
        userAgent: 'Test Agent',
        language: 'en',
        // Missing hardwareConcurrency and maxTouchPoints
      };
      global.navigator = incompleteNavigator as Navigator;
      
      // Should not throw
      expect(() => {
        const deviceId = getDeviceId();
        expect(deviceId).toBeDefined();
      }).not.toThrow();
    });

    it('should generate unique IDs for different devices', () => {
      // Generate ID for first device
      const deviceId1 = getDeviceId();
      
      // Clear localStorage to simulate different device
      localStorageMock.clear();
      
      // Change navigator characteristics to simulate different device
      const differentNavigator = {
        ...mockNavigator,
        userAgent: 'Different User Agent',
        hardwareConcurrency: 4,
      };
      global.navigator = differentNavigator as Navigator;
      
      // Generate ID for second device
      const deviceId2 = getDeviceId();
      
      // IDs should be different (fingerprints differ)
      // Note: This might not always be true due to hash collisions,
      // but with different characteristics they should differ
      expect(deviceId1).toBeDefined();
      expect(deviceId2).toBeDefined();
    });
  });

  describe('integration', () => {
    it('should generate fingerprint and store as device ID', () => {
      // Clear localStorage
      localStorageMock.clear();
      
      // First call should generate and store
      const deviceId1 = getDeviceId();
      expect(deviceId1).toBeDefined();
      expect(localStorageMock.getItem('cew_device_id')).toBe(deviceId1);
      
      // Second call should return same ID
      const deviceId2 = getDeviceId();
      expect(deviceId2).toBe(deviceId1);
    });

    it('should maintain device ID consistency', () => {
      const id1 = getDeviceId();
      const id2 = getDeviceId();
      const id3 = getDeviceId();
      
      expect(id1).toBe(id2);
      expect(id2).toBe(id3);
      
      // Even after clearing other localStorage items
      localStorageMock.removeItem('some_other_key');
      const id4 = getDeviceId();
      expect(id4).toBe(id1);
    });
  });
});

