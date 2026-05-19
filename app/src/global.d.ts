export {};

declare global {
    interface Window {
        __vibeSetStageCamera?: (scale: number, x: number, y: number) => void;
    }
}
