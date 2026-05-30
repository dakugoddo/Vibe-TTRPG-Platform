import { strict as assert } from 'node:assert';
import { ASSET_DRAG_MIME, readAssetDragPayload, writeAssetDragPayload } from './assetDrag';

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

function createDataTransferMock(): DataTransfer {
    const data = new Map<string, string>();
    return {
        effectAllowed: 'uninitialized',
        setData: (format: string, value: string) => {
            data.set(format, value);
        },
        getData: (format: string) => data.get(format) || '',
    } as DataTransfer;
}

test('asset drag payload round-trips image metadata', () => {
    const transfer = createDataTransferMock();
    writeAssetDragPayload(transfer, {
        id: 'asset-map',
        name: 'map.png',
        path: 'maps/map.png',
        url: 'http://localhost:3001/api/assets/file?path=maps%2Fmap.png',
        type: 'image',
    });

    assert.equal(transfer.getData('text/plain'), 'maps/map.png');
    assert.ok(transfer.getData(ASSET_DRAG_MIME).includes('maps/map.png'));
    assert.deepEqual(readAssetDragPayload(transfer), {
        id: 'asset-map',
        name: 'map.png',
        path: 'maps/map.png',
        url: 'http://localhost:3001/api/assets/file?path=maps%2Fmap.png',
        type: 'image',
    });
});

test('asset drag payload rejects malformed data', () => {
    const transfer = createDataTransferMock();
    transfer.setData(ASSET_DRAG_MIME, '{"id":1,"type":"image"}');
    assert.equal(readAssetDragPayload(transfer), null);

    transfer.setData(ASSET_DRAG_MIME, '{"id":"x","name":"x","path":"x","url":"x","type":"bad"}');
    assert.equal(readAssetDragPayload(transfer), null);
});
