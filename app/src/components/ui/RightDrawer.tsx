import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
    labelKey: string;
    titleKey: string;
    subtitleKey: string;
    icon: typeof Database;
}> = [
    {
        id: 'database',
        labelKey: 'rightDrawer.tabs.database.label',
        titleKey: 'rightDrawer.tabs.database.title',
        subtitleKey: 'rightDrawer.tabs.database.subtitle',
        icon: Database,
    },
    {
        id: 'assets',
        labelKey: 'rightDrawer.tabs.assets.label',
        titleKey: 'rightDrawer.tabs.assets.title',
        subtitleKey: 'rightDrawer.tabs.assets.subtitle',
        icon: Archive,
    },
    {
        id: 'chat',
        labelKey: 'rightDrawer.tabs.chat.label',
        titleKey: 'rightDrawer.tabs.chat.title',
        subtitleKey: 'rightDrawer.tabs.chat.subtitle',
        icon: MessageSquare,
    },
];

export function RightDrawer({ isOpen, onClose }: RightDrawerProps) {
    const { t } = useTranslation();
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
                        <h2 className="truncate text-base font-bold uppercase tracking-wide text-[var(--vibe-text-primary)]">{t(activeTab.titleKey)}</h2>
                        <p className="truncate text-xs text-[var(--vibe-text-faint)]">{t(activeTab.subtitleKey)}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="rounded-[var(--vibe-radius-sm)] bg-[var(--vibe-surface-input)] p-2 text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]" title={t('common.collapsePanel')}>
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
                            {t(tab.labelKey)}
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
