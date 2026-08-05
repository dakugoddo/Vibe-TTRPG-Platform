import * as assert from 'node:assert/strict';
import { replaceTextareaSelectionPreservingUndo } from './textareaEditing';

class FakeTextarea {
    value: string;
    selectionStart: number;
    selectionEnd: number;
    focused = false;
    dispatchedTypes: string[] = [];
    ownerDocument: { execCommand?: (command: string, showUi: boolean, value: string) => boolean };

    constructor(value: string, selectionStart: number, selectionEnd: number, execCommand?: (command: string, showUi: boolean, value: string) => boolean) {
        this.value = value;
        this.selectionStart = selectionStart;
        this.selectionEnd = selectionEnd;
        this.ownerDocument = execCommand ? { execCommand } : {};
    }

    focus() {
        this.focused = true;
    }

    setRangeText(text: string, start: number, end: number, selectionMode: SelectionMode) {
        this.value = `${this.value.slice(0, start)}${text}${this.value.slice(end)}`;
        if (selectionMode === 'end') {
            this.selectionStart = start + text.length;
            this.selectionEnd = start + text.length;
        }
    }

    dispatchEvent(event: Event) {
        this.dispatchedTypes.push(event.type);
        return true;
    }
}

let execArgs: unknown[] | null = null;
const nativeTextarea = new FakeTextarea('hello world', 6, 11, (command, showUi, value) => {
    execArgs = [command, showUi, value];
    return true;
});
const nativeResult = replaceTextareaSelectionPreservingUndo(nativeTextarea as unknown as HTMLTextAreaElement, '**world**');
assert.equal(nativeResult, true, 'successful execCommand should report native undo-preserving insertion');
assert.equal(nativeTextarea.focused, true, 'textarea should be focused before native insertion');
assert.deepEqual(execArgs, ['insertText', false, '**world**']);
assert.equal(nativeTextarea.value, 'hello world', 'native path lets the browser mutate the textarea');

const fallbackTextarea = new FakeTextarea('hello world', 6, 11);
const fallbackResult = replaceTextareaSelectionPreservingUndo(fallbackTextarea as unknown as HTMLTextAreaElement, '**world**');
assert.equal(fallbackResult, false, 'fallback path reports non-native insertion');
assert.equal(fallbackTextarea.value, 'hello **world**');
assert.equal(fallbackTextarea.selectionStart, 'hello **world**'.length);
assert.deepEqual(fallbackTextarea.dispatchedTypes, ['input'], 'fallback dispatches input for controlled React state');

console.log('textarea editing tests passed');
