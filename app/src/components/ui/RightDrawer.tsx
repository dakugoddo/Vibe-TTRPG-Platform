import { useState } from 'react';
import { Archive, Database, MessageSquare } from 'lucide-react';
import { AssetBrowser } from './AssetBrowser';
import { ChatPanel } from './ChatPanel';
import { EntityDatabase } from './EntityDatabase';
import { glass } from '../../utils/theme';

interface RightDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

type RightTab = 'database' | 'assets' | 'chat';

const RIGHT_TABS: Array<{
    id: RightTab;
    label: string;
    title: string;
    subtitle: string;
    icon: typeof Database;
}> = [
    {
        id: 'database',
        label: 'Хранилище',
        title: 'База сущностей',
        subtitle: 'Сущности, пространства и быстрые действия',
        icon: Database,
    },
    {
        id: 'assets',
        label: 'Файлы',
        title: 'Файлы мира',
        subtitle: 'Ассеты, изображения и SFX preview',
        icon: Archive,
    },
    {
        id: 'chat',
        label: 'Чат и броски',
        title: 'Журнал сессии',
        subtitle: 'Чат, броски и системные события',
        icon: MessageSquare,
    },
];

export function RightDrawer({ isOpen, onClose }: RightDrawerProps) {
    const [rightTab, setRightTab] = useState<RightTab>('database');
    const activeTab = RIGHT_TABS.find((tab) => tab.id === rightTab) ?? RIGHT_TABS[0];
    const ActiveIcon = activeTab.icon;

    return (
        <div
            className={`fixed bottom-0 right-0 top-0 z-40 flex w-[400px] transform flex-col border-l pointer-events-auto transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'} ${glass.panel}`}
        >
            <div className={`flex items-center justify-between gap-4 p-5 ${glass.panelHeader}`}>
                <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-[var(--vibe-shadow-block)]">
                        <ActiveIcon size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold uppercase tracking-wide text-[var(--vibe-text-primary)]">{activeTab.title}</h2>
                        <p className="truncate text-xs text-[var(--vibe-text-faint)]">{activeTab.subtitle}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="rounded-[var(--vibe-radius-sm)] bg-[var(--vibe-surface-input)] p-2 text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]" title="Свернуть панель">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                </div>
            </div>

            {/* Hub Tabs */}
            <div className={`flex select-none border-b border-[var(--vibe-border-subtle)] ${glass.tabBar}`}>
                {RIGHT_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = rightTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setRightTab(tab.id)}
                            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs font-bold uppercase tracking-wider transition-all ${isActive ? 'border-[var(--vibe-accent)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]' : 'border-transparent text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'}`}
                        >
                            <Icon size={14} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {rightTab === 'assets' && (
                <div className="min-h-0 flex-1">
                    <AssetBrowser />
                </div>
            )}

            {rightTab === 'chat' && (
                <div className="min-h-0 flex-1">
                    <ChatPanel />
                </div>
            )}

            {rightTab === 'database' && (
                <div className="min-h-0 flex-1">
                    <EntityDatabase baseParentId={null} showRootCanvas={true} />
                </div>
            )}
        </div>
    );
}
