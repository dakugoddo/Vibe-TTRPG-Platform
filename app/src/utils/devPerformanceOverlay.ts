export const DEV_PERFORMANCE_OVERLAY_STORAGE_KEY = 'vibe-dev-performance-overlay-enabled';
export const DEV_PERFORMANCE_OVERLAY_EVENT = 'vibe-dev-performance-overlay-change';

export function getDevPerformanceOverlayEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(DEV_PERFORMANCE_OVERLAY_STORAGE_KEY) !== 'false';
}

export function setDevPerformanceOverlayEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DEV_PERFORMANCE_OVERLAY_STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent(DEV_PERFORMANCE_OVERLAY_EVENT, { detail: enabled }));
}
