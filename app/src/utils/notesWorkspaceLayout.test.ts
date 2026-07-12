import assert from 'node:assert/strict';
import {
    closeNotesWorkspaceGroup,
    closeNotesWorkspaceTab,
    createEmptyNotesWorkspaceLayout,
    listNotesWorkspaceGroups,
    mergeNotesWorkspaceGroups,
    moveNotesWorkspaceTab,
    openNotesWorkspaceTab,
    openNotesWorkspaceTabInNewLeaf,
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

let leafOpenLayout = createEmptyNotesWorkspaceLayout();
leafOpenLayout = openNotesWorkspaceTabInNewLeaf(leafOpenLayout, { entityId: 'leaf-note-1', view: 'source' });
groups = listNotesWorkspaceGroups(leafOpenLayout.root);
assert.equal(groups.length, 1, 'Opening into an empty workspace uses the empty leaf');
assert.deepEqual(groups[0].tabs.map((tab) => tab.entityId), ['leaf-note-1']);

leafOpenLayout = openNotesWorkspaceTabInNewLeaf(leafOpenLayout, { entityId: 'leaf-note-2', view: 'preview' });
groups = listNotesWorkspaceGroups(leafOpenLayout.root);
assert.equal(groups.length, 1, 'Opening another entity reuses the active tab block instead of creating a sibling block');
assert.deepEqual(groups[0].tabs.map((tab) => tab.entityId), ['leaf-note-1', 'leaf-note-2']);
assert.equal(leafOpenLayout.activeGroupId, groups[0].id);
assert.equal(groups[0].tabs[1].view, 'preview');
assert.equal(groups[0].activeTabId, groups[0].tabs[1].id);

leafOpenLayout = openNotesWorkspaceTabInNewLeaf(leafOpenLayout, { entityId: 'leaf-note-1', view: 'ui' });
groups = listNotesWorkspaceGroups(leafOpenLayout.root);
assert.equal(groups.length, 1, 'Reopening an existing entity focuses it without creating another tab block');
assert.equal(leafOpenLayout.activeGroupId, groups[0].id);
assert.equal(groups[0].tabs[0].view, 'ui');

let activeBlockLayout = splitActiveNotesWorkspaceGroup(leafOpenLayout, 'row');
groups = listNotesWorkspaceGroups(activeBlockLayout.root);
assert.equal(groups.length, 2, 'Manual split still creates a second tab block');
assert.equal(activeBlockLayout.activeGroupId, groups[1].id, 'The last interacted split block becomes active');
activeBlockLayout = openNotesWorkspaceTabInNewLeaf(activeBlockLayout, { entityId: 'leaf-note-3', view: 'source' });
groups = listNotesWorkspaceGroups(activeBlockLayout.root);
assert.deepEqual(groups.map((group) => group.tabs.map((tab) => tab.entityId)), [['leaf-note-1', 'leaf-note-2'], ['leaf-note-3']], 'New entities open in the active tab block when multiple tab blocks exist');
assert.equal(activeBlockLayout.activeGroupId, groups[1].id);

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
assert.equal(groups.length, 2, 'Dragging the last tab out of a pane collapses the empty source pane');
assert.equal(layout.activeGroupId, groups[0].id, 'New split group becomes active');
assert.equal(groups[0].tabs.length, 1);

const closedGroupId = groups[0].id;
layout = closeNotesWorkspaceGroup(layout, closedGroupId);
groups = listNotesWorkspaceGroups(layout.root);
assert.equal(groups.length, 1, 'Closing a group collapses its parent split to the sibling');
assert.notEqual(layout.activeGroupId, closedGroupId, 'Closed group cannot remain active');

const beforeSingleClose = createEmptyNotesWorkspaceLayout();
const afterSingleClose = closeNotesWorkspaceGroup(beforeSingleClose, listNotesWorkspaceGroups(beforeSingleClose.root)[0].id);
assert.equal(afterSingleClose.root, beforeSingleClose.root, 'The last remaining group cannot be closed');

let mergeBlocksLayout = createEmptyNotesWorkspaceLayout();
mergeBlocksLayout = openNotesWorkspaceTab(mergeBlocksLayout, { entityId: 'source-note-1', view: 'source' });
mergeBlocksLayout = openNotesWorkspaceTab(mergeBlocksLayout, { entityId: 'source-note-2', view: 'preview' });
mergeBlocksLayout = splitActiveNotesWorkspaceGroup(mergeBlocksLayout, 'row');
mergeBlocksLayout = openNotesWorkspaceTab(mergeBlocksLayout, { entityId: 'target-note-1', view: 'ui' });
mergeBlocksLayout = openNotesWorkspaceTab(mergeBlocksLayout, { entityId: 'target-note-2', view: 'graph' });
groups = listNotesWorkspaceGroups(mergeBlocksLayout.root);
const sourceBlockId = groups[0].id;
const sourceActiveTabId = groups[0].activeTabId;
const targetBlockId = groups[1].id;
mergeBlocksLayout = mergeNotesWorkspaceGroups(mergeBlocksLayout, sourceBlockId, targetBlockId);
groups = listNotesWorkspaceGroups(mergeBlocksLayout.root);
assert.equal(groups.length, 1, 'Merging tab blocks collapses the empty source split');
assert.deepEqual(
    groups[0].tabs.map((tab) => tab.entityId),
    ['target-note-1', 'target-note-2', 'source-note-1', 'source-note-2'],
    'All source tabs append to the target block in their existing order'
);
assert.equal(groups[0].activeTabId, sourceActiveTabId, 'The active tab from the dragged block remains active after merge');
assert.equal(mergeBlocksLayout.activeGroupId, targetBlockId, 'The receiving tab block becomes the active area');

const sameBlockMerge = mergeNotesWorkspaceGroups(mergeBlocksLayout, targetBlockId, targetBlockId);
assert.equal(sameBlockMerge, mergeBlocksLayout, 'Dropping a block onto itself is a no-op');

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

let singleSelfSplitLayout = createEmptyNotesWorkspaceLayout();
singleSelfSplitLayout = openNotesWorkspaceTab(singleSelfSplitLayout, { entityId: 'single-self-note', view: 'source' });
groups = listNotesWorkspaceGroups(singleSelfSplitLayout.root);
singleSelfSplitLayout = splitNotesWorkspaceGroupFromTab(
    singleSelfSplitLayout,
    groups[0].id,
    groups[0].tabs[0].id,
    groups[0].id,
    'row',
    'after'
);
groups = listNotesWorkspaceGroups(singleSelfSplitLayout.root);
assert.equal(groups.length, 1, 'Dragging the only tab to the edge of its own pane is a no-op');
assert.deepEqual(groups[0].tabs.map((tab) => tab.entityId), ['single-self-note']);

console.log('notes workspace layout tests passed');
