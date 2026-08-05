export function replaceTextareaSelectionPreservingUndo(textarea: HTMLTextAreaElement, text: string): boolean {
    textarea.focus();

    const execCommand = textarea.ownerDocument?.execCommand;
    if (typeof execCommand === 'function') {
        const inserted = execCommand.call(textarea.ownerDocument, 'insertText', false, text);
        if (inserted) return true;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(text, start, end, 'end');

    const inputEvent = typeof InputEvent === 'function'
        ? new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text })
        : new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);

    return false;
}
