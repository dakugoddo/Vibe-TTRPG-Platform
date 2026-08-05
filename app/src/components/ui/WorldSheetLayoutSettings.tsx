import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Download, FileJson, Loader2, RotateCcw, Save, ShieldCheck, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { EntitySheetBoundary } from '../entitySheets/EntitySheetBoundary';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useUIStore } from '../../store/uiStore';
import {
    getIsHost,
    readPublishedWorldSheetFile,
    readWorldSheetFile,
    resetWorldSheetFile,
    rollbackWorldSheetFile,
    writeWorldSheetFile,
    type WorldSheetReadResult,
} from '../../services/fileApi';
import { GENERIC_NOTE_SHEET_SCHEMA } from '../../utils/builtInEntitySheets';
import { parseWorldSheetDraft } from '../../utils/worldSheetDraft';
import { createWorldSheetOperationGate, type WorldSheetOperationToken } from '../../utils/worldSheetOperationGate';
import { invalidateWorldSheetRequests, setWorldSheetSnapshot } from '../../utils/worldSheetRuntime';
import type { Entity } from '../../types';

const NOTE_SHEET_ID = 'note';
const WORLD_SHEET_REQUEST_TIMEOUT_MS = 8_000;
const secondaryButtonClass = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';
const primaryButtonClass = 'inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-accent)] bg-[var(--vibe-accent-soft)] px-2.5 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-primary)] transition-colors hover:brightness-110';
const PREVIEW_ENTITY: Entity = {
    id: 'sheet-layout-preview',
    parentId: null,
    type: 'note',
    name: 'Preview note',
    description: '## Session clue\n\nA readable **Markdown note** with a short list:\n\n- place\n- person\n- consequence',
    properties: {},
    tags: [],
    database: 'general',
};

function formatSchema(schema: unknown): string {
    return `${JSON.stringify(schema, null, 2)}\n`;
}

interface WorldSheetLayoutSettingsProps {
    roomName: string;
}

export function WorldSheetLayoutSettings({ roomName }: WorldSheetLayoutSettingsProps) {
    const { t } = useTranslation();
    const openConfirm = useUIStore((state) => state.openConfirm);
    const isHost = getIsHost();
    const importInputRef = useRef<HTMLInputElement | null>(null);
    const draftVersionRef = useRef(0);
    const draftDirtyRef = useRef(false);
    const loadControllerRef = useRef<AbortController | null>(null);
    const mutationControllerRef = useRef<AbortController | null>(null);
    const operationGateRef = useRef<ReturnType<typeof createWorldSheetOperationGate> | null>(null);
    if (!operationGateRef.current) operationGateRef.current = createWorldSheetOperationGate();
    const operationGate = operationGateRef.current;
    const [draft, setDraft] = useState(() => formatSchema(GENERIC_NOTE_SHEET_SCHEMA));
    const draftRef = useRef(draft);
    const [stored, setStored] = useState<WorldSheetReadResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [requestError, setRequestError] = useState('');
    const validation = useMemo(() => parseWorldSheetDraft(draft, NOTE_SHEET_ID), [draft]);

    useLayoutEffect(() => {
        draftRef.current = draft;
    }, [draft]);

    const acceptResult = (result: WorldSheetReadResult, successMessage: string, requestVersion: number, operation: WorldSheetOperationToken) => {
        if (!operationGate.isCurrent(operation)) return;
        setWorldSheetSnapshot(roomName, {
            sheetId: result.sheetId,
            exists: result.exists,
            schema: result.schema,
            diagnostics: result.diagnostics,
            hasBackup: result.hasBackup,
        });
        setStored(result);
        if (draftVersionRef.current === requestVersion) {
            setDraft(formatSchema(result.schema ?? GENERIC_NOTE_SHEET_SCHEMA));
            draftVersionRef.current += 1;
            draftDirtyRef.current = false;
            setRequestError('');
        }
        setMessage(successMessage);
    };

    useLayoutEffect(() => {
        operationGate.activateScope(roomName);
        draftVersionRef.current += 1;
        draftDirtyRef.current = false;
        setStored(null);
        setLoading(true);
        setSaving(false);
        setMessage('');
        setRequestError('');
        return () => {
            operationGate.deactivate();
            loadControllerRef.current?.abort();
            mutationControllerRef.current?.abort();
            loadControllerRef.current = null;
            mutationControllerRef.current = null;
        };
    }, [operationGate, roomName]);

    useEffect(() => {
        if (saving) {
            setLoading(false);
            return;
        }
        let cancelled = false;
        const loadDraftVersion = draftVersionRef.current;
        const operation = operationGate.begin('load');
        loadControllerRef.current?.abort();
        const controller = new AbortController();
        loadControllerRef.current = controller;
        const timeoutId = window.setTimeout(() => controller.abort(), WORLD_SHEET_REQUEST_TIMEOUT_MS);
        const load = async () => {
            setLoading(true);
            try {
                const result = isHost
                    ? await readWorldSheetFile(NOTE_SHEET_ID, controller.signal)
                    : await readPublishedWorldSheetFile(NOTE_SHEET_ID, controller.signal);
                if (!result) throw new Error(t('settings.world.sheets.unavailable'));
                if (cancelled || !operationGate.isCurrent(operation)) return;
                setStored(result);
                if (!draftDirtyRef.current && draftVersionRef.current === loadDraftVersion) {
                    setDraft(formatSchema(result.schema ?? GENERIC_NOTE_SHEET_SCHEMA));
                    setRequestError(result.diagnostics.map((item) => item.message).join('\n'));
                }
            } catch (error) {
                if (!cancelled && operationGate.isCurrent(operation)
                    && !draftDirtyRef.current && draftVersionRef.current === loadDraftVersion) {
                    setRequestError(error instanceof Error && error.name === 'AbortError'
                        ? t('settings.world.sheets.unavailable')
                        : error instanceof Error ? error.message : String(error));
                }
            } finally {
                window.clearTimeout(timeoutId);
                if (loadControllerRef.current === controller) loadControllerRef.current = null;
                if (!cancelled && operationGate.isCurrent(operation)) setLoading(false);
            }
        };
        void load();
        return () => {
            cancelled = true;
            window.clearTimeout(timeoutId);
            controller.abort();
            if (loadControllerRef.current === controller) loadControllerRef.current = null;
        };
    }, [isHost, operationGate, roomName, saving, t]);

    const beginMutationOperation = () => {
        draftDirtyRef.current = true;
        operationGate.invalidate('load');
        loadControllerRef.current?.abort();
        loadControllerRef.current = null;
        setLoading(false);
        mutationControllerRef.current?.abort();
        const controller = new AbortController();
        mutationControllerRef.current = controller;
        const timeoutId = window.setTimeout(() => controller.abort(), WORLD_SHEET_REQUEST_TIMEOUT_MS);
        return {
            controller,
            timeoutId,
            operation: operationGate.begin('mutation'),
        };
    };

    const finishMutationOperation = (controller: AbortController, timeoutId: number, operation: WorldSheetOperationToken) => {
        window.clearTimeout(timeoutId);
        if (mutationControllerRef.current === controller) mutationControllerRef.current = null;
        if (operationGate.isScopeCurrent(operation)) invalidateWorldSheetRequests();
        if (operationGate.isCurrent(operation)) setSaving(false);
    };

    const requestErrorMessage = (error: unknown) => (
        error instanceof Error && error.name === 'AbortError'
            ? t('settings.world.sheets.unavailable')
            : error instanceof Error ? error.message : String(error)
    );

    const applyDraft = async () => {
        const currentValidation = parseWorldSheetDraft(draftRef.current, NOTE_SHEET_ID);
        if (!currentValidation.ok || !isHost) return;
        draftVersionRef.current += 1;
        const requestVersion = draftVersionRef.current;
        const { controller, timeoutId, operation } = beginMutationOperation();
        invalidateWorldSheetRequests();
        setSaving(true);
        setMessage('');
        try {
            const schema = { ...currentValidation.schema, status: 'published' as const } as unknown as Record<string, unknown>;
            const result = await writeWorldSheetFile(NOTE_SHEET_ID, schema, controller.signal);
            if (!result) throw new Error(t('settings.world.sheets.unavailable'));
            acceptResult(result, result.backupCreated
                ? t('settings.world.sheets.savedWithBackup')
                : t('settings.world.sheets.saved'), requestVersion, operation);
        } catch (error) {
            if (operationGate.isCurrent(operation)) {
                draftDirtyRef.current = true;
                setRequestError(requestErrorMessage(error));
            }
        } finally {
            finishMutationOperation(controller, timeoutId, operation);
        }
    };

    const rollback = async () => {
        if (!isHost) return;
        draftVersionRef.current += 1;
        const requestVersion = draftVersionRef.current;
        const { controller, timeoutId, operation } = beginMutationOperation();
        invalidateWorldSheetRequests();
        setSaving(true);
        try {
            const result = await rollbackWorldSheetFile(NOTE_SHEET_ID, controller.signal);
            if (!result) throw new Error(t('settings.world.sheets.unavailable'));
            acceptResult(result, t('settings.world.sheets.rolledBack'), requestVersion, operation);
        } catch (error) {
            if (operationGate.isCurrent(operation)) {
                draftDirtyRef.current = true;
                setRequestError(requestErrorMessage(error));
            }
        } finally {
            finishMutationOperation(controller, timeoutId, operation);
        }
    };

    const resetBuiltIn = async () => {
        if (!isHost) return;
        draftVersionRef.current += 1;
        const requestVersion = draftVersionRef.current;
        const { controller, timeoutId, operation } = beginMutationOperation();
        invalidateWorldSheetRequests();
        setSaving(true);
        try {
            const result = await resetWorldSheetFile(NOTE_SHEET_ID, controller.signal);
            if (!result) throw new Error(t('settings.world.sheets.unavailable'));
            acceptResult(result, t('settings.world.sheets.resetDone'), requestVersion, operation);
        } catch (error) {
            if (operationGate.isCurrent(operation)) {
                draftDirtyRef.current = true;
                setRequestError(requestErrorMessage(error));
            }
        } finally {
            finishMutationOperation(controller, timeoutId, operation);
        }
    };

    const importDraft = async (file: File) => {
        if (!isHost) return;
        const importVersion = draftVersionRef.current + 1;
        draftVersionRef.current = importVersion;
        draftDirtyRef.current = true;
        const operation = operationGate.begin('import');
        if (file.size > 256 * 1024) {
            setMessage('');
            setRequestError(t('settings.world.sheets.importTooLarge'));
            return;
        }
        try {
            const content = await file.text();
            if (draftVersionRef.current !== importVersion || !operationGate.isCurrent(operation)) return;
            const imported = parseWorldSheetDraft(content, NOTE_SHEET_ID);
            if (!imported.ok) {
                setDraft(content);
                setRequestError(imported.diagnostics.map((item) => `${item.code}: ${item.message}`).join('\n'));
                return;
            }
            setDraft(imported.canonical);
            setRequestError('');
            setMessage(t('settings.world.sheets.imported'));
        } catch (error) {
            if (draftVersionRef.current === importVersion && operationGate.isCurrent(operation)) {
                setRequestError(error instanceof Error ? error.message : String(error));
            }
        }
    };

    const exportDraft = () => {
        if (!validation.ok) return;
        const blob = new Blob([validation.canonical], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'note.json';
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 0);
        setMessage(t('settings.world.sheets.exported'));
    };

    const confirmApply = () => {
        const operation = operationGate.begin('confirm');
        openConfirm({
            title: t('settings.world.sheets.applyConfirmTitle'),
            description: t('settings.world.sheets.applyConfirmDescription'),
            confirmText: t('settings.world.sheets.apply'),
            cancelText: t('common.cancel'),
            onConfirm: () => {
                if (operationGate.isCurrent(operation)) void applyDraft();
            },
        });
    };
    const confirmRollback = () => {
        const operation = operationGate.begin('confirm');
        openConfirm({
            title: t('settings.world.sheets.rollbackConfirmTitle'),
            description: t('settings.world.sheets.rollbackConfirmDescription'),
            confirmText: t('settings.world.sheets.rollback'),
            cancelText: t('common.cancel'),
            onConfirm: () => {
                if (operationGate.isCurrent(operation)) void rollback();
            },
        });
    };
    const confirmReset = () => {
        const operation = operationGate.begin('confirm');
        openConfirm({
            title: t('settings.world.sheets.resetConfirmTitle'),
            description: t('settings.world.sheets.resetConfirmDescription'),
            confirmText: t('settings.world.sheets.useBuiltIn'),
            cancelText: t('common.cancel'),
            isDestructive: true,
            onConfirm: () => {
                if (operationGate.isCurrent(operation)) void resetBuiltIn();
            },
        });
    };

    const validationErrors = validation.ok ? [] : validation.diagnostics;
    const activeSchema = validation.ok ? validation.schema : GENERIC_NOTE_SHEET_SCHEMA;

    return (
        <div data-world-sheet-settings="note" className="rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-[var(--vibe-text-primary)]">
                        <FileJson size={15} />
                        {t('settings.world.sheets.title')}
                    </div>
                    <p className="mt-1 text-xs text-[var(--vibe-text-faint)]">{t('settings.world.sheets.description')}</p>
                </div>
                <span data-world-sheet-status={stored?.exists ? 'custom' : 'built-in'} className="rounded-full border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">
                    {stored?.exists ? t('settings.world.sheets.customActive') : t('settings.world.sheets.builtInActive')}
                </span>
            </div>

            {loading ? (
                <div className="flex min-h-32 items-center justify-center"><Loader2 className="animate-spin text-[var(--vibe-accent)]" size={20} /></div>
            ) : (
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(280px,0.95fr)]">
                    <div className="min-w-0">
                        <textarea
                            data-world-sheet-draft
                            value={draft}
                            disabled={!isHost || saving}
                            onChange={(event) => {
                                draftVersionRef.current += 1;
                                draftDirtyRef.current = true;
                                setDraft(event.target.value);
                                setMessage('');
                                setRequestError('');
                            }}
                            spellCheck={false}
                            className="h-72 w-full resize-y rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3 font-mono text-[11px] leading-relaxed text-[var(--vibe-text-primary)] outline-none focus:border-[var(--vibe-accent)]"
                        />
                        <input ref={importInputRef} type="file" accept="application/json,.json" disabled={!isHost || saving} className="hidden" onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void importDraft(file);
                            event.currentTarget.value = '';
                        }} />
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button type="button" onClick={() => importInputRef.current?.click()} disabled={!isHost || saving} className={`${secondaryButtonClass} disabled:opacity-40`}><Upload size={13} />{t('settings.world.sheets.import')}</button>
                            <button type="button" onClick={exportDraft} disabled={!validation.ok || saving} className={`${secondaryButtonClass} disabled:opacity-40`}><Download size={13} />{t('settings.world.sheets.export')}</button>
                            <button type="button" onClick={confirmApply} disabled={!isHost || !validation.ok || saving} className={`${primaryButtonClass} disabled:opacity-40`}><Save size={13} />{t('settings.world.sheets.apply')}</button>
                            <button type="button" onClick={confirmRollback} disabled={!isHost || !stored?.hasBackup || saving} className={`${secondaryButtonClass} disabled:opacity-40`}><RotateCcw size={13} />{t('settings.world.sheets.rollback')}</button>
                            <button type="button" onClick={confirmReset} disabled={!isHost || !stored?.exists || saving} className={`${secondaryButtonClass} disabled:opacity-40`}>{t('settings.world.sheets.useBuiltIn')}</button>
                        </div>
                        {!isHost && <p className="mt-2 text-xs text-[var(--vibe-text-faint)]">{t('settings.world.sheets.hostOnly')}</p>}
                    </div>

                    <div className="min-w-0 space-y-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]"><ShieldCheck size={13} />{t('settings.world.sheets.preview')}</div>
                        <div data-world-sheet-preview className="max-h-72 overflow-y-auto rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3 custom-scrollbar">
                            <EntitySheetBoundary entity={PREVIEW_ENTITY} schema={activeSchema} markdownRenderer={MarkdownRenderer} fallback={<p className="text-sm text-[var(--vibe-danger)]">{t('settings.world.sheets.previewFallback')}</p>} />
                        </div>
                        {validationErrors.length > 0 && (
                            <div data-world-sheet-diagnostics className="max-h-32 overflow-y-auto rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-danger)] bg-[color-mix(in_srgb,var(--vibe-danger)_8%,transparent)] p-2 text-xs text-[var(--vibe-danger)]">
                                {validationErrors.map((item, index) => <div key={`${item.code}-${index}`}><strong>{item.code}</strong>: {item.message}</div>)}
                            </div>
                        )}
                        {requestError && <p className="whitespace-pre-wrap text-xs text-[var(--vibe-danger)]">{requestError}</p>}
                        {message && <p className="text-xs text-[var(--vibe-success)]">{message}</p>}
                    </div>
                </div>
            )}
        </div>
    );
}
