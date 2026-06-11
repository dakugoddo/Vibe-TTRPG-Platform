import { strict as assert } from 'node:assert';
import { isDesktopRuntime, selectWorldFolder, showAssetInFolder } from './desktopBridge';

async function test(name: string, fn: () => void | Promise<void>) {
    try {
        await fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

await test('desktop bridge is optional in browser runtime', async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {};

    try {
        assert.equal(isDesktopRuntime(), false);
        assert.equal(await selectWorldFolder(), null);
        assert.equal(await showAssetInFolder('maps/city.png'), false);
    } finally {
        (globalThis as { window?: unknown }).window = previousWindow;
    }
});

await test('desktop bridge delegates folder selection when Electron preload is present', async () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    (globalThis as { window?: unknown }).window = {
        vibeDesktop: {
            isElectron: true,
            platform: 'win32',
            selectWorldFolder: async () => 'C:\\Games\\VibeWorld',
            showAssetInFolder: async (assetPath: string) => assetPath === 'maps/city.png',
        },
    };

    try {
        assert.equal(isDesktopRuntime(), true);
        assert.equal(await selectWorldFolder(), 'C:\\Games\\VibeWorld');
        assert.equal(await showAssetInFolder('maps/city.png'), true);
    } finally {
        (globalThis as { window?: unknown }).window = previousWindow;
    }
});
