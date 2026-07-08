import * as assert from 'node:assert/strict';
import { getUndoRedoShortcutIntent, type ShortcutKeyboardEventLike } from './keyboardShortcuts';

function event(input: Partial<ShortcutKeyboardEventLike>): ShortcutKeyboardEventLike {
    return {
        key: '',
        code: '',
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        ...input,
    };
}

assert.equal(
    getUndoRedoShortcutIntent(event({ ctrlKey: true, key: 'z', code: 'KeyZ' })),
    'undo',
    'Ctrl+Z should undo on English layout'
);

assert.equal(
    getUndoRedoShortcutIntent(event({ ctrlKey: true, key: 'я', code: 'KeyZ' })),
    'undo',
    'Ctrl+physical-Z should undo on Russian layout'
);

assert.equal(
    getUndoRedoShortcutIntent(event({ metaKey: true, key: 'я', code: 'KeyZ' })),
    'undo',
    'Meta+physical-Z should undo on non-English layouts'
);

assert.equal(
    getUndoRedoShortcutIntent(event({ ctrlKey: true, shiftKey: true, key: 'я', code: 'KeyZ' })),
    'redo',
    'Ctrl+Shift+physical-Z should redo on Russian layout'
);

assert.equal(
    getUndoRedoShortcutIntent(event({ ctrlKey: true, key: 'н', code: 'KeyY' })),
    'redo',
    'Ctrl+physical-Y should redo on Russian layout'
);

assert.equal(
    getUndoRedoShortcutIntent(event({ ctrlKey: true, altKey: true, key: 'я', code: 'KeyZ' })),
    null,
    'Alt-modified shortcuts should not trigger canvas undo/redo'
);

assert.equal(
    getUndoRedoShortcutIntent(event({ key: 'я', code: 'KeyZ' })),
    null,
    'Physical Z without ctrl/meta should not undo'
);

console.log('keyboard shortcut tests passed');
