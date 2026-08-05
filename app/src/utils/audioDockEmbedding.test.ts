import * as assert from 'node:assert/strict';
import { observeAudioDockEmbeddedTarget } from './audioDockEmbedding';

const previousWindow = (globalThis as { window?: unknown }).window;
const previousDocument = (globalThis as { document?: unknown }).document;
const previousResizeObserver = (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
const previousMutationObserver = (globalThis as { MutationObserver?: unknown }).MutationObserver;

let mutationCallback: (() => void) | null = null;
let observedMutationTarget: unknown = null;
let resizeObservedTarget: unknown = null;
let target: { getBoundingClientRect: () => { left: number; top: number; width: number; height: number } } | null = null;
const published: Array<null | { left: number; top: number; width: number; height: number }> = [];

class FakeResizeObserver {
  constructor(private readonly callback: () => void) {}
  observe(nextTarget: unknown) {
    resizeObservedTarget = nextTarget;
    this.callback();
  }
  disconnect() {
    resizeObservedTarget = null;
  }
}

class FakeMutationObserver {
  constructor(callback: () => void) {
    mutationCallback = callback;
  }
  observe(nextTarget: unknown) {
    observedMutationTarget = nextTarget;
  }
  disconnect() {
    observedMutationTarget = null;
  }
}

try {
  const body = { nodeType: 1 };
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      requestAnimationFrame(callback: () => void) {
        callback();
        return 1;
      },
      cancelAnimationFrame() {},
      addEventListener() {},
      removeEventListener() {},
    },
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      body,
      documentElement: body,
      getElementById(id: string) {
        return id === 'audio-host' ? target : null;
      },
    },
  });
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: FakeResizeObserver });
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: FakeMutationObserver });

  const cleanup = observeAudioDockEmbeddedTarget('audio-host', (rect) => published.push(rect));

  assert.deepEqual(published, [null], 'Missing initial host publishes null instead of getting stuck with stale geometry');
  assert.equal(observedMutationTarget, body, 'Late host observer watches the document body');
  assert.equal(resizeObservedTarget, null, 'ResizeObserver is not attached until the host exists');

  target = {
    getBoundingClientRect: () => ({ left: 12, top: 34, width: 560, height: 240 }),
  };
  mutationCallback?.();

  assert.deepEqual(
    published[published.length - 1],
    { left: 12, top: 34, width: 560, height: 240 },
    'Late-mounted host publishes its rect without needing to toggle the audio module'
  );
  assert.equal(resizeObservedTarget, target, 'ResizeObserver attaches to the late-mounted host');

  cleanup();
  assert.equal(observedMutationTarget, null, 'cleanup disconnects mutation observer');
  assert.equal(resizeObservedTarget, null, 'cleanup disconnects resize observer');
} finally {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: previousWindow });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument });
  Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: previousResizeObserver });
  Object.defineProperty(globalThis, 'MutationObserver', { configurable: true, value: previousMutationObserver });
}

console.log('audio dock embedding tests passed');
