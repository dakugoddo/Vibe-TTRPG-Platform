import assert from 'node:assert/strict';
import {
    closeNotesWorkspaceTab,
    createEmptyNotesWorkspaceLayout,
    listNotesWorkspaceGroups,
    moveNotesWorkspaceTab,
    openNotesWorkspaceTab,
    setActiveNotesWorkspaceGroup,
    setActiveNotesWorkspaceTab,
    splitActiveNotesWorkspaceGroup,
} from './notesWorkspaceLayout';

let layout = createEmptyNotesWorkspaceLayout();
assert.equal(layout.version, 1);
assert.equal(listNotesWorkspaceGroups(layout.root).length, 1);
assert.equal(listNotesWorkspaceGroups(layout.root)[0].tabs.length, 0);

layout = openNotesWorkspaceTab(layout, { entityId: 'note-1' });
let groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 1);
assert.equal(groups[0].tabs.length, 1);
assert.equal(groups[0].tabs[0].entityId, 'note-1');
assert.equal(groups[0].activeTabId, groups[0].tabs[0].id);

layout = openNotesWorkspaceTab(layout, { entityId: 'note-1' });
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs.length, 1, 'Opening the same entity reuses the existing tab by default');

layout = openNotesWorkspaceTab(layout, { entityId: 'note-1' }, { reuseExisting: false });
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs.length, 2, 'Explicit non-reuse creates another tab');

const firstGroupId = groups[0].id;
const firstTabId = groups[0].tabs[0].id;
layout = setActiveNotesWorkspaceTab(layout, firstGroupId, firstTabId);
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].activeTabId, firstTabId);

layout = splitActiveNotesWorkspaceGroup(layout, 'row');
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 2);
assert.equal(layout.activeGroupId, groups[1].id);

layout = setActiveNotesWorkspaceGroup(layout, groups[0].id);
assert.equal(layout.activeGroupId, groups[0].id);

layout = setActiveNotesWorkspaceGroup(layout, 'missing-group');
assert.equal(layout.activeGroupId, groups[0].id, 'Missing group cannot steal focus');

layout = setActiveNotesWorkspaceGroup(layout, groups[1].id);
assert.equal(layout.activeGroupId, groups[1].id);

layout = openNotesWorkspaceTab(layout, { entityId: 'character-1', view: 'entity' });
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[1].tabs.length, 1);
assert.equal(groups[1].tabs[0].entityId, 'character-1');

layout = moveNotesWorkspaceTab(layout, groups[0].id, groups[0].tabs[1].id, groups[0].id, groups[0].tabs[0].id);
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs[0].entityId, 'note-1', 'Tab can be reordered inside the same group');

layout = moveNotesWorkspaceTab(layout, groups[0].id, groups[0].tabs[0].id, groups[1].id);
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs.length, 1);
assert.equal(groups[1].tabs.length, 2);
assert.equal(groups[1].tabs[1].entityId, 'note-1', 'Tab can move between groups');
assert.equal(layout.activeGroupId, groups[1].id);

layout = closeNotesWorkspaceTab(layout, groups[1].id, groups[1].tabs[0].id);
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[1].tabs.length, 1);
assert.equal(groups[1].activeTabId, groups[1].tabs[0].id);

console.log('notes workspace layout tests passed');
