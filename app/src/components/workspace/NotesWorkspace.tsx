import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { LucideIcon } from 'lucide-react';
import { BookOpen, Box, FileText, Grid2X2, Layers, RotateCcw, Save, User } from 'lucide-react';
import { useEntities } from '../../hooks/useEntities';
import {
    restoreWindowLayoutSnapshot,
    saveCurrentWindowLayoutSnapshot,
    useWindowStore,
} from '../../store/windowStore';
import { yjsStore } from '../../store/yjsStore';
import { canViewEntity } from '../../utils/permissions';
import { glass } from '../../utils/theme';
import type { Entity, EntityType } from '../../types';

interface QuickSectionConfig {
    type: EntityType;
    icon: LucideIcon;
    titleKey: string;
}

const QUICK_SECTIONS: QuickSectionConfig[] = [
    { type: 'note', icon: FileText, titleKey: 'workspace.notes.quickNotes' },
    { type: 'character', icon: User, titleKey: 'workspace.notes.quickCharacters' },
    { type: 'object', icon: Box, titleKey: 'workspace.notes.quickObjects' },
    { type: 'ability', icon: BookOpen, titleKey: 'workspace.notes.quickAbilities' },
];

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

function canShowEntityInWorkspace(entity: Entity): boolean {
    return canViewEntity(
        yjsStore.localRole,
        entity.database ?? 'general',
        getEntityOwnerId(entity),
        yjsStore.localPlayerId,
        yjsStore.localPlayerName
    );
}

function sortByName(left: Entity, right: Entity): number {
    return left.name.localeCompare(right.name, 'ru', { sensitivity: 'base' });
}

export function NotesWorkspace() {
    const { t } = useTranslation();
    const entities = useEntities();
    const windows = useWindowStore((state) => state.windows);
    const focusWindow = useWindowStore((state) => state.focusWindow);
    const openWindow = useWindowStore((state) => state.openWindow);
    const arrangeVisibleWindowsGrid = useWindowStore((state) => state.arrangeVisibleWindowsGrid);
    const cascadeVisibleWindows = useWindowStore((state) => state.cascadeVisibleWindows);

    const visibleEntities = useMemo(
        () => entities.filter((entity) => entity.type !== 'folder' && canShowEntityInWorkspace(entity)).sort(sortByName),
        [entities]
    );

    const entitiesById = useMemo(
        () => new Map(visibleEntities.map((entity) => [entity.id, entity])),
        [visibleEntities]
    );

    const screenWindows = useMemo(
        () => Object.values(windows)
            .filter((win) => !win.isPinned)
            .sort((left, right) => right.zIndex - left.zIndex),
        [windows]
    );

    const quickEntitiesByType = useMemo(
        () => new Map(
            QUICK_SECTIONS.map((section) => [
                section.type,
                visibleEntities.filter((entity) => entity.type === section.type).slice(0, 6),
            ])
        ),
        [visibleEntities]
    );

    const handleOpenEntity = (entity: Entity, index = 0) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        openWindow(entity.id, 140 + column * 72, 128 + row * 52);
    };

    const actionButtonClass = `flex items-center justify-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--vibe-text-muted)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]`;

    return (
        <div className="absolute inset-0 overflow-hidden bg-[var(--vibe-body-bg)]">
            <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                    backgroundImage: `
                        linear-gradient(90deg, color-mix(in_srgb, var(--vibe-border-subtle) 45%, transparent) 1px, transparent 1px),
                        linear-gradient(0deg, color-mix(in_srgb, var(--vibe-border-subtle) 35%, transparent) 1px, transparent 1px)
                    `,
                    backgroundSize: '44px 44px',
                }}
            />
            <main className="relative z-[1] flex h-full min-h-0 gap-4 px-24 pb-8 pt-28">
                <aside className={`flex w-[320px] min-w-[280px] flex-col overflow-hidden rounded-[var(--vibe-radius-lg)] ${glass.panel}`}>
                    <div className={`${glass.panelHeader} p-4`}>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-accent)]">
                            {t('workspace.notes.kicker')}
                        </p>
                        <h2 className="mt-1 text-lg font-black leading-tight text-[var(--vibe-text-primary)]">
                            {t('workspace.notes.title')}
                        </h2>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--vibe-text-faint)]">
                            {t('workspace.notes.subtitle')}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-3">
                        <button type="button" className={actionButtonClass} onClick={arrangeVisibleWindowsGrid}>
                            <Grid2X2 size={14} />
                            {t('workspace.notes.grid')}
                        </button>
                        <button type="button" className={actionButtonClass} onClick={cascadeVisibleWindows}>
                            <Layers size={14} />
                            {t('workspace.notes.cascade')}
                        </button>
                        <button type="button" className={actionButtonClass} onClick={saveCurrentWindowLayoutSnapshot}>
                            <Save size={14} />
                            {t('workspace.notes.save')}
                        </button>
                        <button type="button" className={actionButtonClass} onClick={restoreWindowLayoutSnapshot}>
                            <RotateCcw size={14} />
                            {t('workspace.notes.restore')}
                        </button>
                    </div>

                    <div className="min-h-0 flex-1 overflow-y-auto border-t border-[var(--vibe-border-subtle)] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.openWindows')}
                            </span>
                            <span className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-0.5 font-mono text-[10px] text-[var(--vibe-text-muted)]">
                                {screenWindows.length}
                            </span>
                        </div>

                        {screenWindows.length === 0 ? (
                            <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-4 text-center text-xs text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.noOpenWindows')}
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {screenWindows.map((win) => {
                                    const entity = entitiesById.get(win.entityId);
                                    return (
                                        <button
                                            key={win.id}
                                            type="button"
                                            onClick={() => focusWindow(win.id)}
                                            className="flex w-full min-w-0 items-center justify-between gap-3 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
                                        >
                                            <span className="min-w-0 truncate text-xs font-bold text-[var(--vibe-text-primary)]">
                                                {entity?.name ?? win.entityId}
                                            </span>
                                            <span className="shrink-0 text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                {win.mode}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </aside>

                <section className="flex min-w-0 flex-1 flex-col gap-4">
                    <div className={`flex items-center justify-between rounded-[var(--vibe-radius-lg)] p-4 ${glass.panel}`}>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                {t('workspace.notes.quickAccess')}
                            </p>
                            <h1 className="mt-1 text-xl font-black text-[var(--vibe-text-primary)]">
                                {t('workspace.notes.surfaceTitle')}
                            </h1>
                        </div>
                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-xs font-bold text-[var(--vibe-text-muted)]">
                            {t('workspace.notes.availableCount', { count: visibleEntities.length })}
                        </div>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto pb-12 xl:grid-cols-2">
                        {QUICK_SECTIONS.map((section) => {
                            const Icon = section.icon;
                            const sectionEntities = quickEntitiesByType.get(section.type) ?? [];

                            return (
                                <div key={section.type} className={`min-h-[220px] rounded-[var(--vibe-radius-lg)] ${glass.panel}`}>
                                    <div className={`${glass.panelHeader} flex items-center justify-between p-3`}>
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Icon size={16} className="shrink-0 text-[var(--vibe-accent)]" />
                                            <span className="truncate text-xs font-black uppercase tracking-wider text-[var(--vibe-text-primary)]">
                                                {t(section.titleKey)}
                                            </span>
                                        </div>
                                        <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">
                                            {sectionEntities.length}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 gap-2 p-3 2xl:grid-cols-2">
                                        {sectionEntities.length === 0 ? (
                                            <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] p-4 text-center text-xs text-[var(--vibe-text-faint)]">
                                                {t('workspace.notes.emptySection')}
                                            </div>
                                        ) : sectionEntities.map((entity, index) => (
                                            <button
                                                key={entity.id}
                                                type="button"
                                                onClick={() => handleOpenEntity(entity, index)}
                                                className="group flex min-h-[58px] min-w-0 flex-col justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-2 text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]"
                                            >
                                                <span className="truncate text-sm font-bold text-[var(--vibe-text-primary)] transition-colors group-hover:text-[var(--vibe-accent)]">
                                                    {entity.name}
                                                </span>
                                                <span className="mt-0.5 truncate text-[10px] uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                    {entity.database ?? 'general'}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </main>
        </div>
    );
}
