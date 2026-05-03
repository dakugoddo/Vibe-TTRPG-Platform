import { EntityDatabase } from './EntityDatabase';

interface LeftDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LeftDrawer({ isOpen, onClose }: LeftDrawerProps) {
    return (
        <div
            className={`fixed top-0 left-0 bottom-0 w-[400px] border-r z-40 transition-transform duration-300 transform shadow-[20px_0_50px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'} bg-[#151c2b]/60 backdrop-blur-3xl border-white/10`}
        >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] backdrop-blur-md">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-widest uppercase">Инвентарь</h2>
                        <p className="text-xs text-white/50">Личные предметы</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
            </div>

            {/* Future GM / Player Inventory Switcher */}
            <div className="flex border-b border-white/10 bg-[#0a0e17]/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] p-2 text-xs">
                <button className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-white font-bold ml-2 shadow-[0_4px_12px_rgba(255,255,255,0.05)]">Мои предметы</button>
                <button className="px-3 py-1.5 text-white/50 hover:text-white ml-2 italic tooltip-trigger">
                    Другие игроки (ГМ)...
                    <span className="tooltip-text opacity-0 absolute text-[10px] bg-black text-white p-1 rounded">Будет добавлено</span>
                </button>
            </div>

            <div className="flex-1 overflow-hidden p-2 flex flex-col">
                <div className="flex-1 rounded-xl border border-white/10 shadow-inner min-h-0 flex flex-col overflow-hidden bg-white/5">
                    <EntityDatabase baseParentId="my-personal-inventory" headerTitle="Личный инвентарь" allowedTabs={['object', 'note', 'character']} targetDb="user" />
                </div>
            </div>
        </div>
    );
}
