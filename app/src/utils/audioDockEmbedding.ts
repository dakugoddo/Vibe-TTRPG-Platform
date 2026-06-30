export interface AudioDockEmbeddedRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export type AudioDockEmbeddedRectPublisher = (rect: AudioDockEmbeddedRect | null) => void;

export function observeAudioDockEmbeddedTarget(
    embeddedTargetId: string,
    publishRect: AudioDockEmbeddedRectPublisher
): () => void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        publishRect(null);
        return () => undefined;
    }

    let frameId: number | null = null;
    let target: HTMLElement | null = null;
    let resizeObserver: ResizeObserver | null = null;

    const publishNextFrame = (rect: AudioDockEmbeddedRect | null) => {
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        frameId = window.requestAnimationFrame(() => {
            publishRect(rect);
            frameId = null;
        });
    };

    const updateRect = () => {
        if (!target) {
            publishNextFrame(null);
            return;
        }

        const rect = target.getBoundingClientRect();
        publishNextFrame({
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        });
    };

    const disconnectResizeObserver = () => {
        resizeObserver?.disconnect();
        resizeObserver = null;
    };

    const attachTargetIfAvailable = () => {
        const nextTarget = document.getElementById(embeddedTargetId);
        if (!nextTarget || nextTarget === target) return;

        disconnectResizeObserver();
        target = nextTarget;
        updateRect();
        resizeObserver = new ResizeObserver(updateRect);
        resizeObserver.observe(target);
    };

    publishNextFrame(null);
    attachTargetIfAvailable();

    const mutationObserver = new MutationObserver(attachTargetIfAvailable);
    mutationObserver.observe(document.body ?? document.documentElement, { childList: true, subtree: true });

    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);

    return () => {
        if (frameId !== null) window.cancelAnimationFrame(frameId);
        disconnectResizeObserver();
        mutationObserver.disconnect();
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
    };
}
