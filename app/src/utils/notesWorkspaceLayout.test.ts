import assert from 'node:assert/strict';
import {
    closeNotesWorkspaceGroup,
    closeNotesWorkspaceTab,
    createEmptyNotesWorkspaceLayout,
    listNotesWorkspaceGroups,
    moveNotesWorkspaceTab,
    openNotesWorkspaceTab,
    setActiveNotesWorkspaceGroup,
    setActiveNotesWorkspaceTab,
    setNotesWorkspaceSplitRatio,
    setNotesWorkspaceTabView,
    splitActiveNotesWorkspaceGroup,
    splitNotesWorkspaceGroupFromTab,
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
assert.equal(groups[0].tabs[0].view, 'source');
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

layout = setNotesWorkspaceTabView(layout, firstGroupId, firstTabId, 'preview');
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs[0].view, 'preview', 'Active tab view can change without opening another tab');

layout = openNotesWorkspaceTab(layout, { entityId: 'note-1', view: 'graph' });
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups[0].tabs.length, 2, 'Opening an already-open entity reuses the existing tab regardless of current view');
assert.equal(groups[0].tabs[0].view, 'graph', 'Reopening an entity can switch the existing tab to the requested view');

layout = splitActiveNotesWorkspaceGroup(layout, 'row');
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 2);
assert.equal(layout.activeGroupId, groups[1].id);
assert.equal(layout.root.type, 'split');
assert.equal(layout.root.ratio, 0.5);

layout = setNotesWorkspaceSplitRatio(layout, layout.root.id, 0.7);
assert.equal(layout.root.type, 'split');
assert.equal(layout.root.ratio, 0.7);

layout = setNotesWorkspaceSplitRatio(layout, layout.root.id, 0.02);
assert.equal(layout.root.type, 'split');
assert.equal(layout.root.ratio, 0.18, 'Split ratio is clamped to keep the first pane usable');

layout = setNotesWorkspaceSplitRatio(layout, layout.root.id, 0.95);
assert.equal(layout.root.type, 'split');
assert.equal(layout.root.ratio, 0.82, 'Split ratio is clamped to keep the second pane usable');

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

layout = splitNotesWorkspaceGroupFromTab(layout, groups[1].id, groups[1].tabs[0].id, groups[0].id, 'column', 'before');
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 3, 'Dragging a tab to an edge can create a new split group');
assert.equal(layout.activeGroupId, groups[0].id, 'New split group becomes active');
assert.equal(groups[0].tabs.length, 1);

const closedGroupId = groups[0].id;
layout = closeNotesWorkspaceGroup(layout, closedGroupId);
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 2, 'Closing a group collapses its parent split to the sibling');
assert.notEqual(layout.activeGroupId, closedGroupId, 'Closed group cannot remain active');

const beforeSingleClose = createEmptyNotesWorkspaceLayout();
const afterSingleClose = closeNotesWorkspaceGroup(beforeSingleClose, listNotesWorkspaceGroups(beforeSingleClose.root)[0].id);
assert.equal(afterSingleClose.root, beforeSingleClose.root, 'The last remaining group cannot be closed');

let selfSplitLayout = createEmptyNotesWorkspaceLayout();
selfSplitLayout = openNotesWorkspaceTab(selfSplitLayout, { entityId: 'self-note-1', view: 'source' });
selfSplitLayout = openNotesWorkspaceTab(selfSplitLayout, { entityId: 'self-note-2', view: 'preview' });
groups = listNotesWorkspaceGroups(selfSplitLayout.root);
selfSplitLayout = splitNotesWorkspaceGroupFromTab(
    selfSplitLayout,
    groups[0].id,
    groups[0].tabs[1].id,
    groups[0].id,
    'row',
    'after'
);
groups = listNotesWorkspaceGroups(selfSplitLayout.root);
assert.equal(groups.length, 2, 'Dragging a tab to the edge of its own pane creates a sibling pane');
assert.deepEqual(groups.map((group) => group.tabs.map((tab) => tab.entityId)), [['self-note-1'], ['self-note-2']]);

console.log('notes workspace layout tests passed');
