export function isAnimatedGifSource(source: string): boolean {
  const value = source.trim();
  if (!value) return false;
  if (/^data:image\/gif[;,]/i.test(value)) return true;

  try {
    const url = new URL(value, typeof window !== 'undefined' ? window.location.href : 'http://localhost');
    const assetPath = url.searchParams.get('path');
    const candidate = assetPath || url.pathname;
    return /\.gif$/i.test(decodeURIComponent(candidate));
  } catch {
    return /\.gif(?:$|[?#])/i.test(value) || /%2egif(?:$|[&#])/i.test(value.toLowerCase());
  }
}
