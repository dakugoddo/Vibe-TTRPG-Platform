import { useState, useEffect } from 'react';
import { EntityDatabase } from './EntityDatabase';
import { yjsStore } from '../../store/yjsStore';
import { listPlayers } from '../../services/fileApi';
import { getIsHost } from '../../services/fileApi';
import { Users, User } from 'lucide-react';

interface LeftDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LeftDrawer({ isOpen, onClose }: LeftDrawerProps) {
    const isGM = getIsHost() || yjsStore.localRole === 'gm';
    const [players, setPlayers] = useState<string[]>([]);
    const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
    const [loadingPlayers, setLoadingPlayers] = useState(false);

    useEffect(() => {
        if (!isGM || !isOpen) return;

        let cancelled = false;
        const loadPlayers = async () => {
            setLoadingPlayers(true);
            try {
                const loadedPlayers = await listPlayers();
                if (!cancelled) setPlayers(loadedPlayers);
            } catch {
                if (!cancelled) setPlayers([]);
            } finally {
                if (!cancelled) setLoadingPlayers(false);
            }
        };

        void loadPlayers();
        return () => {
            cancelled = true;
        };
    }, [isGM, isOpen]);

    const handleSelectPlayer = (playerName: string | null) => {
        setSelectedPlayer(playerName);
    };

    const ownerFilter = selectedPlayer || yjsStore.localPlayerName;

    return (
        <div
            className={`fixed top-0 left-0 bottom-0 w-[400px] border-r z-40 transition-transform duration-300 transform shadow-[20px_0_50px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'} bg-[#151c2b]/60 backdrop-blur-3xl border-white/10`}
        >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white shadow-[0_2px_10px_rgba(0,0,0,0.3)] backdrop-blur-md">
                        <Users size={18} />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-white tracking-widest uppercase">
                            {selectedPlayer ? `Инвентарь: ${selectedPlayer}` : 'Инвентарь'}
                        </h2>
                        <p className="text-xs text-white/50">
                            {selectedPlayer ? 'Предметы игрока' : 'Личные предметы'}
                        </p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                </button>
            </div>

            {/* Player selector for GM */}
            {isGM && (
                <div className="flex border-b border-white/10 bg-[#0a0e17]/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] p-2 text-xs overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => handleSelectPlayer(null)}
                        className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${!selectedPlayer ? 'bg-white/15 border border-white/20 text-white shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}
                    >
                        <User size={12} className="inline mr-1" />
                        Мои предметы
                    </button>
                    {loadingPlayers ? (
                        <span className="px-3 py-1.5 text-white/30 italic">Загрузка...</span>
                    ) : (
                        players.map(playerName => (
                            <button
                                key={playerName}
                                onClick={() => handleSelectPlayer(playerName)}
                                className={`px-3 py-1.5 rounded-lg font-bold whitespace-nowrap ml-1 transition-all ${selectedPlayer === playerName ? 'bg-violet-500/20 border border-violet-500/40 text-violet-200 shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}
                            >
                                <User size={12} className="inline mr-1" />
                                {playerName}
                            </button>
                        ))
                    )}
                    {!loadingPlayers && players.length === 0 && (
                        <span className="px-3 py-1.5 text-white/30 italic">Нет других игроков</span>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-hidden p-2 flex flex-col">
                <div className="flex-1 rounded-xl border border-white/10 shadow-inner min-h-0 flex flex-col overflow-hidden bg-white/5">
                    <EntityDatabase
                        baseParentId={null}
                        headerTitle={selectedPlayer ? `Инвентарь: ${selectedPlayer}` : 'Личный инвентарь'}
                        allowedTabs={['object', 'note', 'character']}
                        targetDb="user"
                        playerFilter={ownerFilter}
                    />
                </div>
            </div>
        </div>
    );
}
