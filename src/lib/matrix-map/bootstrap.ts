// Worker manager for bootstrap UCL calculations.
// Traced to: docs/PROUCL_V52_EXTRACTION_PACKET_2026_06_06.md Section F.
// Plain ASCII only.

import { performBootstrap } from './bootstrap.worker';

export interface BootstrapResults {
  percentile95: number;
  bca95: number;
  bootstrapT95: number;
}

// Runs bootstrap UCLs. If running in a browser environment with Worker support,
// spins up the Web Worker to prevent UI thread blocking. Otherwise, falls back
// to synchronous execution (for test / Node environments).
export function bootstrapUcls(
  values: number[],
  B: number = 2000,
  seed: number = 123456789
): Promise<BootstrapResults> {
  const n = values.length;
  if (n < 2) {
    return Promise.resolve({
      percentile95: Number.NaN,
      bca95: Number.NaN,
      bootstrapT95: Number.NaN
    });
  }

  // Check if Web Worker is supported and available (Browser only)
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') {
    return new Promise<BootstrapResults>((resolve, reject) => {
      try {
        // Native Web Worker setup compatible with Next.js 15
        const worker = new Worker(new URL('./bootstrap.worker.ts', import.meta.url));
        
        worker.onmessage = (event) => {
          const { status, results, error } = event.data;
          worker.terminate();
          if (status === 'success') {
            resolve(results);
          } else {
            try {
              resolve(performBootstrap(values, B, seed));
            } catch (e) {
              reject(e);
            }
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          try {
            resolve(performBootstrap(values, B, seed));
          } catch (e) {
            reject(e);
          }
        };

        worker.postMessage({ values, B, seed });
      } catch (err) {
        // Fallback to sync if spawning worker fails
        try {
          resolve(performBootstrap(values, B, seed));
        } catch (e) {
          reject(e);
        }
      }
    });
  }

  // Synchronous fallback for test/Node environment
  try {
    return Promise.resolve(performBootstrap(values, B, seed));
  } catch (err) {
    return Promise.reject(err);
  }
}

// Direct synchronous wrapper for testing
export function bootstrapUclsSync(
  values: number[],
  B: number = 2000,
  seed: number = 123456789
): BootstrapResults {
  return performBootstrap(values, B, seed);
}
