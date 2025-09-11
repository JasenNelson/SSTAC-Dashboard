/**
 * Generate a unique device fingerprint for anonymous users
 * This helps prevent multiple votes from the same device
 */

export function generateDeviceFingerprint(): string {
  // Get browser characteristics
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx?.fillText('Device fingerprint', 2, 2);
  const canvasFingerprint = canvas.toDataURL();
  
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width + 'x' + screen.height,
    new Date().getTimezoneOffset(),
    canvasFingerprint.slice(-50), // Last 50 chars of canvas data
    navigator.hardwareConcurrency || 'unknown',
    navigator.maxTouchPoints || 'unknown'
  ].join('|');
  
  // Create a hash-like string
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `device_${Math.abs(hash).toString(36)}`;
}

export function getDeviceId(): string {
  // Check if we already have a device ID stored
  let deviceId = localStorage.getItem('cew_device_id');
  
  if (!deviceId) {
    // Generate new device ID
    deviceId = generateDeviceFingerprint();
    localStorage.setItem('cew_device_id', deviceId);
    console.log('Generated new device ID:', deviceId);
  }
  
  return deviceId;
}
