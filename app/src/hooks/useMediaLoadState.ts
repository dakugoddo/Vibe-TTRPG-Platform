import { useCallback, useMemo, useState } from 'react';
import { appendAssetRetryParam, type MediaLoadStatus } from '../utils/assetLoadState';

export function useMediaLoadState(src: string | null | undefined) {
    const currentSrc = src ?? '';
    const [retryNonce, setRetryNonce] = useState(0);
    const [loadResult, setLoadResult] = useState<{ src: string; retryNonce: number; status: MediaLoadStatus }>({
        src: currentSrc,
        retryNonce,
        status: currentSrc ? 'loading' : 'idle',
    });

    const mediaSrc = useMemo(
        () => (currentSrc ? appendAssetRetryParam(currentSrc, retryNonce) : ''),
        [currentSrc, retryNonce]
    );

    const status = loadResult.src === currentSrc && loadResult.retryNonce === retryNonce
        ? loadResult.status
        : currentSrc
            ? 'loading'
            : 'idle';

    const markReady = useCallback(() => {
        setLoadResult({ src: currentSrc, retryNonce, status: 'ready' });
    }, [currentSrc, retryNonce]);

    const markError = useCallback(() => {
        setLoadResult({ src: currentSrc, retryNonce, status: 'error' });
    }, [currentSrc, retryNonce]);

    const retry = useCallback(() => {
        if (!currentSrc) return;
        setRetryNonce((current) => current + 1);
    }, [currentSrc]);

    return {
        mediaSrc,
        retry,
        status,
        isError: status === 'error',
        isLoading: status === 'loading',
        isReady: status === 'ready',
        markError,
        markReady,
    };
}
