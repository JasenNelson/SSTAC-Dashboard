/**
 * Track votes to prevent multiple submissions from same device
 */

export interface VoteTracker {
  deviceId: string;
  userAgent: string;
  timestamp: number;
  pagePath: string;
  pollIndex: number;
}

// Device ID function
function getDeviceId(): string {
  let deviceId = localStorage.getItem('cew_device_id');
  if (!deviceId) {
    // Simple device ID based on user agent + timestamp
    deviceId = `device_${btoa(navigator.userAgent + Date.now()).slice(0, 16)}`;
    localStorage.setItem('cew_device_id', deviceId);
  }
  return deviceId;
}

export function hasVoted(pagePath: string, pollIndex: number): boolean {
  const trackerKey = `cew_tracker_${pagePath}_${pollIndex}`;
  return localStorage.getItem(trackerKey) !== null;
}

export function trackVote(pagePath: string, pollIndex: number): boolean {
  const deviceId = getDeviceId();
  const userAgent = navigator.userAgent;
  const timestamp = Date.now();
  
  // Create unique key for this poll
  const trackerKey = `cew_tracker_${pagePath}_${pollIndex}`;
  
  // Check if this device already voted on this poll
  const existingTracker = localStorage.getItem(trackerKey);
  if (existingTracker) {
    // Tracker exists - device already voted
    if (process.env.NODE_ENV === 'development') {
      console.log(`Device ${deviceId} already voted on ${pagePath} poll ${pollIndex}`);
    }
    return false; // Already voted
  }
  
  // Store tracker info
  const tracker: VoteTracker = {
    deviceId,
    userAgent,
    timestamp,
    pagePath,
    pollIndex
  };
  
  localStorage.setItem(trackerKey, JSON.stringify(tracker));
  if (process.env.NODE_ENV === 'development') {
    console.log(`Tracked vote for device ${deviceId} on ${pagePath} poll ${pollIndex}`);
  }
  return true; // New vote allowed
}

export function clearVoteTracking(pagePath: string, pollIndex: number): void {
  const trackerKey = `cew_tracker_${pagePath}_${pollIndex}`;
  localStorage.removeItem(trackerKey);
  if (process.env.NODE_ENV === 'development') {
    console.log(`Cleared vote tracking for ${pagePath} poll ${pollIndex}`);
  }
}
