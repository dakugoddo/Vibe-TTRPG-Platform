import assert from 'node:assert/strict';
import {
  DEV_PERFORMANCE_OVERLAY_EVENT,
  DEV_PERFORMANCE_OVERLAY_STORAGE_KEY,
  getDevPerformanceOverlayEnabled,
  setDevPerformanceOverlayEnabled,
} from './devPerformanceOverlay';

function installWindowMock() {
  const store = new Map<string, string>();
  const events: Array<{ type: string; detail?: unknown }> = [];
  const previousWindow = (globalThis as typeof globalThis & { window?: unknown }).window;
  const previousCustomEvent = (globalThis as typeof globalThis & { CustomEvent?: unknown }).CustomEvent;

  class MockCustomEvent {
    type: string;
    detail?: unknown;

    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  (globalThis as typeof globalThis & { CustomEvent: unknown }).CustomEvent = MockCustomEvent;
  (globalThis as typeof globalThis & { window: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
    dispatchEvent: (event: { type: string; detail?: unknown }) => {
      events.push({ type: event.type, detail: event.detail });
      return true;
    },
  };

  return {
    store,
    events,
    restore: () => {
      if (previousWindow === undefined) {
        delete (globalThis as typeof globalThis & { window?: unknown }).window;
      } else {
        (globalThis as typeof globalThis & { window: unknown }).window = previousWindow;
      }
      if (previousCustomEvent === undefined) {
        delete (globalThis as typeof globalThis & { CustomEvent?: unknown }).CustomEvent;
      } else {
        (globalThis as typeof globalThis & { CustomEvent: unknown }).CustomEvent = previousCustomEvent;
      }
    },
  };
}

const mock = installWindowMock();
try {
  assert.equal(getDevPerformanceOverlayEnabled(), false, 'overlay should be opt-in by default');

  setDevPerformanceOverlayEnabled(true);
  assert.equal(mock.store.get(DEV_PERFORMANCE_OVERLAY_STORAGE_KEY), 'true');
  assert.equal(getDevPerformanceOverlayEnabled(), true);
  assert.deepEqual(mock.events.at(-1), { type: DEV_PERFORMANCE_OVERLAY_EVENT, detail: true });

  setDevPerformanceOverlayEnabled(false);
  assert.equal(mock.store.get(DEV_PERFORMANCE_OVERLAY_STORAGE_KEY), 'false');
  assert.equal(getDevPerformanceOverlayEnabled(), false);
  assert.deepEqual(mock.events.at(-1), { type: DEV_PERFORMANCE_OVERLAY_EVENT, detail: false });

  console.log('ok - dev performance overlay is opt-in and dispatches changes');
} finally {
  mock.restore();
}
