import { useState } from 'react';
import { Archive, Database, MessageSquare } from 'lucide-react';
import { AssetBrowser } from './AssetBrowser';
import { ChatPanel } from './ChatPanel';
import { EntityDatabase } from './EntityDatabase';

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
            className={`fixed top-0 right-0 bottom-0 w-[400px] border-l z-40 transition-transform duration-300 transform shadow-[-20px_0_50px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'} bg-[#151c2b]/60 backdrop-blur-3xl border-white/10`}
        >
            <div className="p-5 border-b border-white/10 flex justify-between items-center gap-4 bg-white/[0.06]">
                <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-amber-200/80 shadow-inner">
                        <ActiveIcon size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-white tracking-wide uppercase">{activeTab.title}</h2>
                        <p className="truncate text-xs text-white/45">{activeTab.subtitle}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Свернуть панель">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                </div>
            </div>

            {/* Hub Tabs */}
            <div className="flex border-b border-white/10 bg-[#0a0e17]/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] select-none">
                {RIGHT_TABS.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = rightTab === tab.id;

                    return (
                        <button
                            key={tab.id}
                            onClick={() => setRightTab(tab.id)}
                            className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex justify-center items-center gap-2 ${isActive ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
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
