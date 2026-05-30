import { useState, useEffect } from 'react';
import { User, Users, X } from 'lucide-react';
import { listPlayers } from '../../services/fileApi';
import { getIsHost } from '../../services/fileApi';
import { yjsStore } from '../../store/yjsStore';
import { EntityDatabase } from './EntityDatabase';

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
    const drawerTitle = selectedPlayer ? `Инвентарь: ${selectedPlayer}` : 'Личный инвентарь';
    const drawerSubtitle = selectedPlayer
        ? 'Предметы выбранного игрока'
        : isGM
            ? 'Мои предметы и инвентари игроков'
            : 'Предметы, заметки и персонажи';

    return (
        <div
            className={`fixed top-0 left-0 bottom-0 w-[400px] border-r z-40 transition-transform duration-300 transform shadow-[20px_0_50px_rgba(0,0,0,0.5)] pointer-events-auto flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'} bg-[#151c2b]/60 backdrop-blur-3xl border-white/10`}
        >
            <div className="p-5 border-b border-white/10 flex justify-between items-center gap-4 bg-white/[0.06]">
                <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/25 text-amber-200/80 shadow-inner">
                        <Users size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-white tracking-wide uppercase">{drawerTitle}</h2>
                        <p className="truncate text-xs text-white/45">{drawerSubtitle}</p>
                    </div>
                </div>
                <button onClick={onClose} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-colors" title="Свернуть панель">
                    <X size={18} />
                </button>
            </div>

            {/* Player selector for GM */}
            {isGM && (
                <div className="flex gap-1.5 border-b border-white/10 bg-[#0a0e17]/60 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)] p-2 text-xs overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => handleSelectPlayer(null)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${!selectedPlayer ? 'bg-white/15 border border-white/20 text-white shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}
                    >
                        <User size={12} className="flex-shrink-0" />
                        Мои предметы
                    </button>
                    {loadingPlayers ? (
                        <span className="px-3 py-1.5 text-white/30 italic">Загрузка...</span>
                    ) : (
                        players.map(playerName => (
                            <button
                                key={playerName}
                                onClick={() => handleSelectPlayer(playerName)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold whitespace-nowrap transition-all ${selectedPlayer === playerName ? 'bg-amber-400/15 border border-amber-300/30 text-amber-100 shadow-md' : 'text-white/50 hover:text-white hover:bg-white/5 border border-transparent'}`}
                            >
                                <User size={12} className="flex-shrink-0" />
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
                        headerTitle={drawerTitle}
                        allowedTabs={['object', 'note', 'character']}
                        targetDb="user"
                        playerFilter={ownerFilter}
                    />
                </div>
            </div>
        </div>
    );
}
