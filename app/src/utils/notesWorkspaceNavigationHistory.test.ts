import * as assert from 'node:assert/strict';
import {
    createEmptyNotesWorkspaceNavigationHistory,
    getNotesWorkspaceNavigationDirection,
    recordNotesWorkspaceNavigation,
    type NotesWorkspaceNavigationEntry,
} from './notesWorkspaceNavigationHistory';

function entry(entityId: string, tabId = `${entityId}-tab`): NotesWorkspaceNavigationEntry {
    return { groupId: 'group-1', tabId, entityId, view: 'source' };
}

let history = createEmptyNotesWorkspaceNavigationHistory();
assert.equal(history.current, null);
assert.equal(getNotesWorkspaceNavigationDirection(history, 'back'), null);
assert.equal(getNotesWorkspaceNavigationDirection(history, 'forward'), null);

history = recordNotesWorkspaceNavigation(history, entry('note-1'));
assert.deepEqual(history.current?.entityId, 'note-1');
assert.equal(history.backStack.length, 0);
assert.equal(history.forwardStack.length, 0);
assert.equal(getNotesWorkspaceNavigationDirection(history, 'back'), null);

history = recordNotesWorkspaceNavigation(history, entry('note-2'));
assert.equal(history.current?.entityId, 'note-2');
assert.deepEqual(history.backStack.map((item) => item.entityId), ['note-1']);
assert.equal(getNotesWorkspaceNavigationDirection(history, 'back')?.entry.entityId, 'note-1');

let result = getNotesWorkspaceNavigationDirection(history, 'back');
assert.ok(result);
history = result.history;
assert.equal(result.entry.entityId, 'note-1');
assert.equal(history.current?.entityId, 'note-1');
assert.deepEqual(history.forwardStack.map((item) => item.entityId), ['note-2']);
assert.equal(getNotesWorkspaceNavigationDirection(history, 'forward')?.entry.entityId, 'note-2');

result = getNotesWorkspaceNavigationDirection(history, 'forward');
assert.ok(result);
history = result.history;
assert.equal(result.entry.entityId, 'note-2');
assert.equal(history.current?.entityId, 'note-2');
assert.equal(history.forwardStack.length, 0);

history = recordNotesWorkspaceNavigation(history, entry('note-2'));
assert.deepEqual(history.backStack.map((item) => item.entityId), ['note-1'], 'Recording the same position is a no-op');

result = getNotesWorkspaceNavigationDirection(history, 'back');
assert.ok(result);
history = result.history;
history = recordNotesWorkspaceNavigation(history, entry('note-3'));
assert.equal(history.current?.entityId, 'note-3');
assert.deepEqual(history.backStack.map((item) => item.entityId), ['note-1']);
assert.equal(history.forwardStack.length, 0, 'Opening a new entity after Back clears Forward history');

console.log('notes workspace navigation history tests passed');
