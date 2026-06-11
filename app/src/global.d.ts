export {};

declare global {
    interface VibeCameraPerfTestOptions {
        durationMs?: number;
        amplitude?: number;
        restoreCamera?: boolean;
    }

    interface VibeCameraPerfTestResult {
        ok: boolean;
        reason?: string;
        frames: number;
        avgFps: number;
        maxFrameMs: number;
        droppedFrames: number;
        durationMs: number;
    }

    interface VibeCameraPerfCounters {
        panPreviewMoves: number;
        panPreviewFrames: number;
        panStageCommits: number;
    }

    interface VibeDesktopApi {
        isElectron: true;
        platform: string;
        selectWorldFolder: () => Promise<string | null>;
        showAssetInFolder: (assetPath: string) => Promise<boolean>;
    }

    interface Window {
        __vibeSetStageCamera?: (scale: number, x: number, y: number) => void;
        __vibeSetPinnedLayerCamera?: (scale: number, x: number, y: number) => void;
        __vibeRunCameraPerfTest?: (options?: VibeCameraPerfTestOptions) => Promise<VibeCameraPerfTestResult>;
        __vibeCameraPerfCounters?: VibeCameraPerfCounters;
        vibeDesktop?: VibeDesktopApi;
    }
}
