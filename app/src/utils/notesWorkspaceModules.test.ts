import assert from 'node:assert/strict';
import {
    IMPLEMENTED_NOTES_SHELL_MODULE_IDS,
    NOTES_WORKSPACE_MODULES,
    canToggleNotesShellModule,
    hasVisibleNotesShellModule,
    groupVisibleNotesShellModules,
    isImplementedNotesShellModuleId,
    listImplementedNotesShellModules,
    listVisibleNotesShellModules,
    mergeNotesShellModuleTabs,
    removeNotesShellModuleFromTabs,
    type NotesWorkspaceShellTabGroup,
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

const initialTabGroups: NotesWorkspaceShellTabGroup[] = [
    { id: 'shell-group-1', moduleIds: ['context', 'search'], activeModuleId: 'search' },
];
const groupedGraphAndNotifications = mergeNotesShellModuleTabs(initialTabGroups, 'graph', 'notifications');
assert.deepEqual(groupedGraphAndNotifications, [
    { id: 'shell-group-1', moduleIds: ['context', 'search'], activeModuleId: 'search' },
    { id: 'shell-group-notifications', moduleIds: ['notifications', 'graph'], activeModuleId: 'graph' },
], 'Center-drop should create a tab group and activate the dragged module');
assert.deepEqual(
    mergeNotesShellModuleTabs(groupedGraphAndNotifications, 'graph', 'notifications'),
    groupedGraphAndNotifications,
    'Dropping a module onto a sibling tab should not duplicate it'
);
assert.deepEqual(
    mergeNotesShellModuleTabs(groupedGraphAndNotifications, 'search', 'graph'),
    [
        { id: 'shell-group-notifications', moduleIds: ['notifications', 'graph', 'search'], activeModuleId: 'search' },
    ],
    'Moving a tab out of a two-tab source group should dissolve the one-tab remainder'
);

assert.deepEqual(
    removeNotesShellModuleFromTabs(groupedGraphAndNotifications, 'graph'),
    initialTabGroups,
    'Dragging a module to an edge should detach it and dissolve a one-tab remainder'
);

const visibleRight = listVisibleNotesShellModules(
    { ...shell, context: true, notifications: true, graph: true },
    'right'
);
const renderGroups = groupVisibleNotesShellModules(visibleRight, groupedGraphAndNotifications);
assert.deepEqual(renderGroups.map((group) => ({
    id: group.id,
    moduleIds: group.modules.map((module) => module.id),
    activeModuleId: group.activeModuleId,
})), [
    { id: 'shell-group-1', moduleIds: ['context'], activeModuleId: 'context' },
    { id: 'shell-group-notifications', moduleIds: ['notifications', 'graph'], activeModuleId: 'graph' },
]);

console.log('notes workspace modules tests passed');
