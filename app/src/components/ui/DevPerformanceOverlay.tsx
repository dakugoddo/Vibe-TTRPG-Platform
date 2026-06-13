import { useEffect, useState } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useCanvasSyncStore } from '../../store/canvasSyncStore';
import { getEntitiesSnapshot } from '../../store/entityStore';
import { useWindowStore } from '../../store/windowStore';
import { DEV_PERFORMANCE_OVERLAY_EVENT, getDevPerformanceOverlayEnabled } from '../../utils/devPerformanceOverlay';

interface PerformanceMemory {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface DevPerfSnapshot {
  fps: number;
  avgFrameMs: number;
  maxFrameMs: number;
  droppedFrames: number;
  heapMb: number | null;
  heapTotalMb: number | null;
  entityCount: number;
  canvasElementCount: number;
  windowCount: number;
  pinnedWindowCount: number;
  activeCanvasId: string;
  scale: number;
  offsetX: number;
  offsetY: number;
  viewport: string;
  dpr: number;
  runtime: string;
  panMovesPerSecond: number;
  panFramesPerSecond: number;
  panCommitsPerSecond: number;
}

function readMemory(): { heapMb: number | null; heapTotalMb: number | null } {
  const memory = (performance as Performance & { memory?: PerformanceMemory }).memory;
  if (!memory) return { heapMb: null, heapTotalMb: null };
  return {
    heapMb: memory.usedJSHeapSize / 1024 / 1024,
    heapTotalMb: memory.totalJSHeapSize / 1024 / 1024,
  };
}

function readSnapshot(
  fps: number,
  avgFrameMs: number,
  maxFrameMs: number,
  droppedFrames: number,
  panMovesPerSecond: number,
  panFramesPerSecond: number,
  panCommitsPerSecond: number,
  previous?: DevPerfSnapshot,
): DevPerfSnapshot {
  const canvas = useCanvasStore.getState();
  const canvasSync = useCanvasSyncStore.getState();
  const memory = readMemory();
  const shouldRefreshAppCounters = !previous || Date.now() % 3000 < 1100;
  const windows = shouldRefreshAppCounters ? Object.values(useWindowStore.getState().windows) : [];

  return {
    fps,
    avgFrameMs,
    maxFrameMs,
    droppedFrames,
    ...memory,
    entityCount: shouldRefreshAppCounters ? Object.keys(getEntitiesSnapshot()).length : previous?.entityCount ?? 0,
    canvasElementCount: shouldRefreshAppCounters ? canvasSync.elements.length : previous?.canvasElementCount ?? 0,
    windowCount: shouldRefreshAppCounters ? windows.length : previous?.windowCount ?? 0,
    pinnedWindowCount: shouldRefreshAppCounters ? windows.filter((win) => win.isPinned).length : previous?.pinnedWindowCount ?? 0,
    activeCanvasId: canvas.activeCanvasId,
    scale: canvas.scale,
    offsetX: canvas.offset.x,
    offsetY: canvas.offset.y,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    dpr: window.devicePixelRatio || 1,
    runtime: window.vibeDesktop?.isElectron ? `Electron/${window.vibeDesktop.platform}` : 'Browser',
    panMovesPerSecond,
    panFramesPerSecond,
    panCommitsPerSecond,
  };
}

function formatNumber(value: number, digits = 0): string {
  return value.toFixed(digits);
}

export function DevPerformanceOverlay() {
  const [snapshot, setSnapshot] = useState<DevPerfSnapshot>(() => readSnapshot(0, 0, 0, 0, 0, 0, 0));
  const [enabled, setEnabled] = useState(getDevPerformanceOverlayEnabled);

  useEffect(() => {
    const handleChange = () => setEnabled(getDevPerformanceOverlayEnabled());
    window.addEventListener(DEV_PERFORMANCE_OVERLAY_EVENT, handleChange);
    window.addEventListener('storage', handleChange);
    return () => {
      window.removeEventListener(DEV_PERFORMANCE_OVERLAY_EVENT, handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || !enabled) return;

    let rafId = 0;
    let lastFrame = performance.now();
    let windowStart = lastFrame;
    let frames = 0;
    let frameMsTotal = 0;
    let maxFrameMs = 0;
    let droppedFrames = 0;
    let lastPanMoves = window.__vibeCameraPerfCounters?.panPreviewMoves ?? 0;
    let lastPanFrames = window.__vibeCameraPerfCounters?.panPreviewFrames ?? 0;
    let lastPanCommits = window.__vibeCameraPerfCounters?.panStageCommits ?? 0;

    const tick = (now: number) => {
      const frameMs = now - lastFrame;
      lastFrame = now;
      frames += 1;
      frameMsTotal += frameMs;
      maxFrameMs = Math.max(maxFrameMs, frameMs);
      if (frameMs > 34) droppedFrames += 1;

      const elapsed = now - windowStart;
      if (elapsed >= 1000) {
        const fps = (frames * 1000) / elapsed;
        const avgFrameMs = frameMsTotal / Math.max(1, frames);
        const counters = window.__vibeCameraPerfCounters;
        const panMoves = counters?.panPreviewMoves ?? lastPanMoves;
        const panFrames = counters?.panPreviewFrames ?? lastPanFrames;
        const panCommits = counters?.panStageCommits ?? lastPanCommits;
        const panMovesPerSecond = (panMoves - lastPanMoves) * 1000 / elapsed;
        const panFramesPerSecond = (panFrames - lastPanFrames) * 1000 / elapsed;
        const panCommitsPerSecond = (panCommits - lastPanCommits) * 1000 / elapsed;
        lastPanMoves = panMoves;
        lastPanFrames = panFrames;
        lastPanCommits = panCommits;
        setSnapshot((previous) => readSnapshot(
          fps,
          avgFrameMs,
          maxFrameMs,
          droppedFrames,
          panMovesPerSecond,
          panFramesPerSecond,
          panCommitsPerSecond,
          previous,
        ));
        windowStart = now;
        frames = 0;
        frameMsTotal = 0;
        maxFrameMs = 0;
        droppedFrames = 0;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [enabled]);

  if (!import.meta.env.DEV || !enabled) return null;

  const fpsTone =
    snapshot.fps >= 55
      ? 'text-emerald-300'
      : snapshot.fps >= 30
        ? 'text-amber-300'
        : 'text-red-300';

  return (
    <div className="pointer-events-none fixed bottom-4 left-4 z-[9999] w-[260px] rounded-[var(--vibe-radius-md)] border border-white/15 bg-slate-950/90 px-3 py-2 font-mono text-[11px] leading-5 text-slate-200">
      <div className="mb-1 flex items-center justify-between border-b border-white/10 pb-1">
        <span className="text-slate-400">DEV PERF</span>
        <span className={fpsTone}>{formatNumber(snapshot.fps)} FPS</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3">
        <span className="text-slate-500">frame</span>
        <span>{formatNumber(snapshot.avgFrameMs, 1)} ms avg</span>
        <span className="text-slate-500">max frame</span>
        <span>{formatNumber(snapshot.maxFrameMs, 1)} ms</span>
        <span className="text-slate-500">drops</span>
        <span>{snapshot.droppedFrames}/sec</span>
        <span className="text-slate-500">heap</span>
        <span>
          {snapshot.heapMb == null
            ? 'n/a'
            : `${formatNumber(snapshot.heapMb)} / ${formatNumber(snapshot.heapTotalMb ?? 0)} MB`}
        </span>
        <span className="text-slate-500">entities</span>
        <span>{snapshot.entityCount}</span>
        <span className="text-slate-500">canvas</span>
        <span>{snapshot.canvasElementCount} items</span>
        <span className="text-slate-500">windows</span>
        <span>
          {snapshot.windowCount} / {snapshot.pinnedWindowCount} pinned
        </span>
        <span className="text-slate-500">camera</span>
        <span>
          {formatNumber(snapshot.scale, 2)}x {formatNumber(snapshot.offsetX)},{formatNumber(snapshot.offsetY)}
        </span>
        <span className="text-slate-500">pan input</span>
        <span>
          {formatNumber(snapshot.panMovesPerSecond)}/s, {formatNumber(snapshot.panFramesPerSecond)}/s frames
        </span>
        <span className="text-slate-500">pan commit</span>
        <span>{formatNumber(snapshot.panCommitsPerSecond)}/s</span>
        <span className="text-slate-500">canvas id</span>
        <span className="truncate">{snapshot.activeCanvasId}</span>
        <span className="text-slate-500">viewport</span>
        <span>
          {snapshot.viewport} @{formatNumber(snapshot.dpr, 1)}
        </span>
        <span className="text-slate-500">runtime</span>
        <span>{snapshot.runtime}</span>
      </div>
    </div>
  );
}
