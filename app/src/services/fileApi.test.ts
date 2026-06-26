import { strict as assert } from 'node:assert';
import { getAssetUrl, getFileServerUrl } from './fileApi';

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

test('asset URLs use the stable file endpoint for asset paths', () => {
    assert.equal(
        getAssetUrl('music/sfx/door open.mp3'),
        'http://localhost:3001/api/assets/file?path=music%2Fsfx%2Fdoor%20open.mp3'
    );
});

test('relative API asset URLs are anchored to the file server', () => {
    assert.equal(
        getAssetUrl('/api/assets/file?path=maps%2Fmap.png'),
        'http://localhost:3001/api/assets/file?path=maps%2Fmap.png'
    );
    assert.equal(
        getAssetUrl('/api/assets/old.png'),
        'http://localhost:3001/api/assets/file?path=old.png'
    );
    assert.equal(
        getAssetUrl('http://127.0.0.1:3001/api/assets/old.png'),
        'http://localhost:3001/api/assets/file?path=old.png'
    );
});

test('asset URLs follow the joined host for player clients', () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const localStorage = {
        getItem: (key: string) => key === 'vibe_server_ip' ? '25.55.120.14' : null,
    };

    (globalThis as { window?: unknown }).window = {
        localStorage,
        location: { hostname: 'localhost' },
    };

    try {
        assert.equal(getFileServerUrl(), 'http://25.55.120.14:3001');
        assert.equal(
            getAssetUrl('portraits/hero.png'),
            'http://25.55.120.14:3001/api/assets/file?path=portraits%2Fhero.png'
        );
    } finally {
        (globalThis as { window?: unknown }).window = previousWindow;
    }
});
