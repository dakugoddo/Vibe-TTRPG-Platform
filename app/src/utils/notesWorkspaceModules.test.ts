import assert from 'node:assert/strict';
import {
    IMPLEMENTED_NOTES_SHELL_MODULE_IDS,
    NOTES_WORKSPACE_MODULES,
    canToggleNotesShellModule,
    hasVisibleNotesShellModule,
    isImplementedNotesShellModuleId,
    listImplementedNotesShellModules,
    listVisibleNotesShellModules,
    type NotesWorkspaceShellVisibility,
} from './notesWorkspaceModules';

assert.deepEqual(IMPLEMENTED_NOTES_SHELL_MODULE_IDS, ['editor', 'vault', 'context', 'notifications', 'search', 'graph', 'audio']);
assert.equal(isImplementedNotesShellModuleId('editor'), true);
assert.equal(isImplementedNotesShellModuleId('vault'), true);
assert.equal(isImplementedNotesShellModuleId('search'), true);
assert.equal(isImplementedNotesShellModuleId('graph'), true);
assert.equal(isImplementedNotesShellModuleId('audio'), true);
assert.equal(canToggleNotesShellModule('editor'), false);
assert.equal(canToggleNotesShellModule('vault'), true);

assert.deepEqual(
    listImplementedNotesShellModules().map((module) => module.id),
    ['editor', 'vault', 'context', 'notifications', 'search', 'graph', 'audio'],
    'Only implemented modules should be exposed to live shell toggles'
);

assert.deepEqual(
    listImplementedNotesShellModules('center').map((module) => module.id),
    ['editor'],
    'The main editor participates in the same shell module registry as side modules'
);

assert.deepEqual(
    listImplementedNotesShellModules('right').map((module) => module.id),
    ['context', 'notifications', 'search', 'graph'],
    'Right shell modules preserve registry order'
);

assert.deepEqual(
    listImplementedNotesShellModules('bottom').map((module) => module.id),
    ['audio'],
    'Bottom shell modules are registered separately from the right rail'
);

const shell: NotesWorkspaceShellVisibility = {
    editor: true,
    vault: true,
    context: false,
    notifications: true,
    search: false,
    graph: false,
    audio: false,
};

assert.deepEqual(listVisibleNotesShellModules(shell).map((module) => module.id), ['editor', 'vault', 'notifications']);
assert.equal(hasVisibleNotesShellModule(shell, 'center'), true);
assert.equal(hasVisibleNotesShellModule(shell, 'left'), true);
assert.equal(hasVisibleNotesShellModule(shell, 'right'), true);
assert.equal(hasVisibleNotesShellModule({ ...shell, notifications: false }, 'right'), false);
assert.equal(hasVisibleNotesShellModule({ ...shell, audio: true }, 'bottom'), true);

assert.ok(
    NOTES_WORKSPACE_MODULES.some((module) => module.id === 'audio' && module.status === 'implemented' && module.defaultArea === 'bottom'),
    'Audio is a live bottom dock module, not hardcoded into the canvas dock'
);

console.log('notes workspace modules tests passed');
