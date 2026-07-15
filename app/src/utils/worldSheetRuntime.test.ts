import assert from 'node:assert/strict';
import {
    clearWorldSheetSnapshot,
    getWorldSheetRequestGeneration,
    getWorldSheetSnapshot,
    invalidateWorldSheetRequests,
    setWorldSheetSnapshot,
    subscribeWorldSheetSnapshots,
} from './worldSheetRuntime';

let notifications = 0;
const unsubscribe = subscribeWorldSheetSnapshots(() => {
    notifications += 1;
});

setWorldSheetSnapshot('world-a', {
    sheetId: 'note',
    exists: true,
    schema: { schemaVersion: 1, id: 'world-a-note' },
    diagnostics: [],
    hasBackup: false,
});
setWorldSheetSnapshot('world-b', {
    sheetId: 'note',
    exists: false,
    schema: null,
    diagnostics: [],
    hasBackup: false,
});
assert.equal(getWorldSheetSnapshot('world-a', 'note')?.exists, true);
assert.equal(getWorldSheetSnapshot('world-b', 'note')?.exists, false);
assert.equal(getWorldSheetSnapshot('world-c', 'note'), null, 'unknown world must fail closed instead of reusing another world snapshot');
assert.equal(notifications, 2);

clearWorldSheetSnapshot('world-a', 'note');
assert.equal(getWorldSheetSnapshot('world-a', 'note'), null);
assert.equal(getWorldSheetSnapshot('world-b', 'note')?.exists, false, 'clearing world A must not clear world B');
assert.equal(notifications, 3);

unsubscribe();
setWorldSheetSnapshot('world-b', {
    sheetId: 'note',
    exists: true,
    schema: { schemaVersion: 1, id: 'updated-world-b-note' },
    diagnostics: [],
    hasBackup: false,
});
assert.equal(notifications, 3);
clearWorldSheetSnapshot('world-b', 'note');

const generation = getWorldSheetRequestGeneration();
invalidateWorldSheetRequests();
assert.equal(getWorldSheetRequestGeneration(), generation + 1);

console.log('world sheet runtime tests passed');
