import assert from 'node:assert/strict';
import {
  DEV_PERFORMANCE_OVERLAY_EVENT,
  DEV_PERFORMANCE_OVERLAY_STORAGE_KEY,
  getDevPerformanceOverlayEnabled,
  setDevPerformanceOverlayEnabled,
} from './devPerformanceOverlay';

class MemoryStorage {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const listeners: Array<(event: CustomEvent<boolean>) => void> = [];

Object.defineProperty(globalThis, 'window', {
  value: {
    localStorage: new MemoryStorage(),
    dispatchEvent(event: CustomEvent<boolean>) {
      listeners.forEach((listener) => listener(event));
      return true;
    },
    addEventListener(type: string, listener: (event: CustomEvent<boolean>) => void) {
      if (type === DEV_PERFORMANCE_OVERLAY_EVENT) listeners.push(listener);
    },
  },
  configurable: true,
});

assert.equal(getDevPerformanceOverlayEnabled(), false, 'Dev performance overlay is hidden by default');

let lastDetail: boolean | null = null;
window.addEventListener(DEV_PERFORMANCE_OVERLAY_EVENT, (event) => {
  lastDetail = event.detail;
});

setDevPerformanceOverlayEnabled(true);
assert.equal(window.localStorage.getItem(DEV_PERFORMANCE_OVERLAY_STORAGE_KEY), 'true');
assert.equal(lastDetail, true);
assert.equal(getDevPerformanceOverlayEnabled(), true, 'Explicit true enables the overlay');

setDevPerformanceOverlayEnabled(false);
assert.equal(window.localStorage.getItem(DEV_PERFORMANCE_OVERLAY_STORAGE_KEY), 'false');
assert.equal(lastDetail, false);
assert.equal(getDevPerformanceOverlayEnabled(), false, 'Explicit false disables the overlay');

console.log('dev performance overlay tests passed');
