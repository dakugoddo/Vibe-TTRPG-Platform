import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { BookOpen, Map } from 'lucide-react';
import { onSyncStatus } from '../../services/fileSyncService';
import { getIsHost } from '../../services/fileApi';
import { glass } from '../../utils/theme';
import type { WorkspaceMode } from '../../utils/workspaceMode';

interface HudBarProps {
    roomName: string;
    onLeave: () => void;
    onOpenDatabase: () => void;
    dbOpen: boolean;
    workspaceMode: WorkspaceMode;
    onWorkspaceModeChange: (mode: WorkspaceMode) => void;
}

export function HudBar({ roomName, onLeave, onOpenDatabase, dbOpen, workspaceMode, onWorkspaceModeChange }: HudBarProps) {
    const { t } = useTranslation();
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

    useEffect(() => {
        if (getIsHost()) {
            onSyncStatus((status) => setSaveStatus(status));
        }
    }, []);

    return (
        <>
            {/* Right side static modules (Connection & Canvas List) */}
            <div className="absolute top-6 right-6 w-[350px] z-30 max-h-[calc(100vh-48px)] flex flex-col pointer-events-none gap-4">
                {/* Header HUD */}
                <header className={`pointer-events-auto flex items-center justify-between rounded-[var(--vibe-radius-lg)] p-4 ${glass.panel}`}>
                    <div className="flex items-center gap-4 cursor-default">
                        <div className="flex h-10 w-10 select-none items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] font-bold text-[var(--vibe-accent)] shadow-[var(--vibe-shadow-block)]">
                            V
                        </div>
                        <div>
                            <h2 className="text-sm font-bold leading-tight text-[var(--vibe-text-primary)]">{t('hud.room')} <span className="text-[var(--vibe-text-muted)]">{roomName}</span></h2>
                            <div className="flex items-center gap-2">
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--vibe-success)] shadow-[0_0_8px_var(--vibe-success)]"></span>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">{t('hud.connected')}</p>
                                {getIsHost() && saveStatus !== 'idle' && (
                                    <span className={`ml-1 text-[10px] uppercase ${saveStatus === 'saving' ? 'text-[var(--vibe-warning)]' :
                                            saveStatus === 'saved' ? 'text-[var(--vibe-success)]' :
                                                saveStatus === 'error' ? 'text-[var(--vibe-danger)]' : ''
                                        }`}>
                                        {saveStatus === 'saving' ? '⏳' : saveStatus === 'saved' ? '💾' : '❌'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onLeave}
                        className="cursor-pointer rounded-[var(--vibe-radius-sm)] p-2 text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-danger)]"
                        title={t('hud.leave')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </button>
                </header>

                <div className={`pointer-events-auto grid grid-cols-2 gap-1 rounded-[var(--vibe-radius-lg)] p-1 ${glass.panel}`}>
                    <button
                        type="button"
                        onClick={() => onWorkspaceModeChange('canvas')}
                        className={`flex h-10 items-center justify-center gap-2 rounded-[var(--vibe-radius-sm)] text-xs font-bold uppercase tracking-wider transition-colors ${workspaceMode === 'canvas'
                            ? glass.iconButtonActive
                            : 'text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                            }`}
                        title={t('workspace.mode.canvas')}
                    >
                        <Map size={15} />
                        {t('workspace.mode.canvas')}
                    </button>
                    <button
                        type="button"
                        onClick={() => onWorkspaceModeChange('notes')}
                        className={`flex h-10 items-center justify-center gap-2 rounded-[var(--vibe-radius-sm)] text-xs font-bold uppercase tracking-wider transition-colors ${workspaceMode === 'notes'
                            ? glass.iconButtonActive
                            : 'text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                            }`}
                        title={t('workspace.mode.notes')}
                    >
                        <BookOpen size={15} />
                        {t('workspace.mode.notes')}
                    </button>
                </div>

                <button
                    onClick={onOpenDatabase}
                    className={`pointer-events-auto flex cursor-pointer items-center justify-between rounded-[var(--vibe-radius-lg)] p-4 hover:bg-[var(--vibe-surface-hover)] ${glass.panel}`}
                >
                    <div className="flex items-center gap-3">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--vibe-accent)]"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m3 15 2 2 4-4" /></svg>
                        <span className="text-sm font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">{t('hud.databaseHub')}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transform text-[var(--vibe-text-faint)] transition-transform ${dbOpen ? 'translate-x-1' : ''}`}><polyline points="15 18 9 12 15 6" /></svg>
                </button>
            </div>
        </>
    );
}
