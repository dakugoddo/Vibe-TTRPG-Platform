export function isDesktopRuntime(): boolean {
    return Boolean(window.vibeDesktop?.isElectron);
}

export async function selectWorldFolder(): Promise<string | null> {
    if (!window.vibeDesktop) return null;
    return window.vibeDesktop.selectWorldFolder();
}

export async function showAssetInFolder(assetPath: string): Promise<boolean> {
    if (!window.vibeDesktop?.showAssetInFolder) return false;
    return window.vibeDesktop.showAssetInFolder(assetPath);
}

export async function showTranslationsFolder(): Promise<string | null> {
    if (!window.vibeDesktop?.showTranslationsFolder) return null;
    return window.vibeDesktop.showTranslationsFolder();
}

export async function openPreviewWorld(): Promise<string | null> {
    if (!window.vibeDesktop?.openPreviewWorld) return null;
    return window.vibeDesktop.openPreviewWorld();
}
