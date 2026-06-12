export type MediaLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

export function appendAssetRetryParam(src: string, retryNonce: number): string {
    if (!src || retryNonce <= 0 || src.startsWith('data:') || src.startsWith('blob:')) return src;

    try {
        const url = new URL(src, globalThis.location?.href ?? 'http://localhost');
        url.searchParams.set('retry', String(retryNonce));
        return url.toString();
    } catch {
        const separator = src.includes('?') ? '&' : '?';
        return `${src}${separator}retry=${retryNonce}`;
    }
}
