import assert from 'node:assert/strict';
import {
    APP_MODULE_IDS,
    getDefaultAppModuleEnablement,
    getEnabledAppModuleIds,
    isAppModuleEnabled,
    isAppModuleId,
    normalizeAppModuleEnablement,
    setAppModuleEnabled,
} from './appModules';

assert.deepEqual(APP_MODULE_IDS, ['assetLibrary', 'audio', 'canvasTools', 'rulesEngine', 'future3d']);
assert.equal(isAppModuleId('audio'), true);
assert.equal(isAppModuleId('unknown'), false);

assert.deepEqual(getDefaultAppModuleEnablement(), {
    assetLibrary: true,
    audio: true,
    canvasTools: true,
    rulesEngine: true,
    future3d: false,
});

assert.deepEqual(normalizeAppModuleEnablement({
    assetLibrary: false,
    audio: false,
    rulesEngine: false,
    future3d: true,
    unknown: true,
}), {
    assetLibrary: true,
    audio: false,
    canvasTools: true,
    rulesEngine: true,
    future3d: true,
});

assert.deepEqual(setAppModuleEnabled({ audio: true }, 'audio', false), {
    assetLibrary: true,
    audio: false,
    canvasTools: true,
    rulesEngine: true,
    future3d: false,
});

assert.deepEqual(setAppModuleEnabled({ rulesEngine: false }, 'rulesEngine', false), {
    assetLibrary: true,
    audio: true,
    canvasTools: true,
    rulesEngine: true,
    future3d: false,
});

assert.equal(isAppModuleEnabled({ audio: false }, 'audio'), false);
assert.deepEqual(getEnabledAppModuleIds({ audio: false, future3d: true }), [
    'assetLibrary',
    'canvasTools',
    'rulesEngine',
    'future3d',
]);

console.log('ok - app module registry normalization');
