import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { User, Users, X } from 'lucide-react';
import { listPlayers } from '../../services/fileApi';
import { getIsHost } from '../../services/fileApi';
import { yjsStore } from '../../store/yjsStore';
import { EntityDatabase } from './EntityDatabase';
import { glass } from '../../utils/theme';

interface LeftDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

export function LeftDrawer({ isOpen, onClose }: LeftDrawerProps) {
    const { t } = useTranslation();
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
    const drawerTitle = selectedPlayer ? t('leftDrawer.inventoryForPlayer', { player: selectedPlayer }) : t('leftDrawer.personalInventory');
    const drawerSubtitle = selectedPlayer
        ? t('leftDrawer.selectedPlayerItems')
        : isGM
            ? t('leftDrawer.gmItems')
            : t('leftDrawer.playerItems');

    return (
        <div
            className={`fixed bottom-0 left-0 top-0 z-40 flex w-[400px] transform flex-col border-r pointer-events-auto transition-transform duration-300 ${isOpen ? 'translate-x-0' : '-translate-x-full'} ${glass.panel}`}
        >
            <div className={`flex items-center justify-between gap-4 p-5 ${glass.panelHeader}`}>
                <div className="min-w-0 flex items-center gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-[var(--vibe-shadow-block)]">
                        <Users size={18} />
                    </div>
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold uppercase tracking-wide text-[var(--vibe-text-primary)]">{drawerTitle}</h2>
                        <p className="truncate text-xs text-[var(--vibe-text-faint)]">{drawerSubtitle}</p>
                    </div>
                </div>
                <button onClick={onClose} className="rounded-[var(--vibe-radius-sm)] bg-[var(--vibe-surface-input)] p-2 text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]" title={t('common.collapsePanel')}>
                    <X size={18} />
                </button>
            </div>

            {/* Player selector for GM */}
            {isGM && (
                <div className={`flex gap-1.5 overflow-x-auto border-b border-[var(--vibe-border-subtle)] p-2 text-xs no-scrollbar ${glass.tabBar}`}>
                    <button
                        onClick={() => handleSelectPlayer(null)}
                        className={`inline-flex items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-3 py-1.5 font-bold whitespace-nowrap transition-all ${!selectedPlayer ? glass.tabActive : glass.tabIdle}`}
                    >
                        <User size={12} className="flex-shrink-0" />
                        {t('leftDrawer.myItems')}
                    </button>
                    {loadingPlayers ? (
                        <span className="px-3 py-1.5 italic text-[var(--vibe-text-faint)]">{t('common.loading')}</span>
                    ) : (
                        players.map(playerName => (
                            <button
                                key={playerName}
                                onClick={() => handleSelectPlayer(playerName)}
                                className={`inline-flex items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border px-3 py-1.5 font-bold whitespace-nowrap transition-all ${selectedPlayer === playerName ? glass.tabActive : glass.tabIdle}`}
                            >
                                <User size={12} className="flex-shrink-0" />
                                {playerName}
                            </button>
                        ))
                    )}
                    {!loadingPlayers && players.length === 0 && (
                        <span className="px-3 py-1.5 italic text-[var(--vibe-text-faint)]">{t('leftDrawer.noOtherPlayers')}</span>
                    )}
                </div>
            )}

            <div className="flex-1 overflow-hidden p-2 flex flex-col">
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] shadow-[var(--vibe-shadow-block)]">
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
