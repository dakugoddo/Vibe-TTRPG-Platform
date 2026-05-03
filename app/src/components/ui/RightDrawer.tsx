import { useState } from 'react';
import { ChatPanel } from './ChatPanel';
import { EntityDatabase } from './EntityDatabase';

interface RightDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function RightDrawer({ isOpen, onClose }: RightDrawerProps) {
    const [rightTab, setRightTab] = useState<'database' | 'chat'>('database');

    return (
        <div
            className={`fixed top-0 right-0 bottom-0 w-[400px] border-l z-40 transition-transform duration-300 transform shadow-[-20px_0_50px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'} bg-[#151c2b]/60 backdrop-blur-3xl border-white/10`}
        >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div>
                    <h2 className="text-lg font-bold text-white tracking-widest uppercase">База Сущностей</h2>
                    <p className="text-xs text-white/50">Глобальное хранилище и Чат</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                    </button>
                </div>
            </div>

            {/* Hub Tabs */}
            <div className="flex border-b border-white/10 bg-[#0a0e17]/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] select-none">
                <button
                    onClick={() => setRightTab('database')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex justify-center items-center gap-2 ${rightTab === 'database' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>
                    Хранилище
                </button>
                <button
                    onClick={() => setRightTab('chat')}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 flex justify-center items-center gap-2 ${rightTab === 'chat' ? 'text-white border-white bg-white/10' : 'text-white/40 border-transparent hover:text-white/80 hover:bg-white/5'}`}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                    Чат и Броски
                </button>
            </div>

            {rightTab === 'chat' && (
                <ChatPanel />
            )}

            {rightTab === 'database' && (
                <EntityDatabase baseParentId={null} showRootCanvas={true} />
            )}
        </div>
    );
}
