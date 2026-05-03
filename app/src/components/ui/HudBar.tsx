import { useTranslation } from 'react-i18next';
import { useState, useEffect } from 'react';
import { onSyncStatus } from '../../services/fileSyncService';
import { getIsHost } from '../../services/fileApi';

interface HudBarProps {
    roomName: string;
    onLeave: () => void;
    onOpenDatabase: () => void;
    dbOpen: boolean;
}

export function HudBar({ roomName, onLeave, onOpenDatabase, dbOpen }: HudBarProps) {
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
                <header className={`flex justify-between items-center bg-black/20 backdrop-blur-2xl p-4 rounded-xl shadow-2xl border border-white/10 pointer-events-auto`}>
                    <div className="flex items-center gap-4 cursor-default">
                        <div className="w-10 h-10 bg-gradient-to-br from-white/60 to-white/50 rounded-lg shadow-[0_0_15px_rgba(255,255,255,0.1)] flex items-center justify-center border border-white/60 font-bold select-none text-white">
                            V
                        </div>
                        <div>
                            <h2 className="text-sm font-bold text-white/90 leading-tight">{t('hud.room')} <span className="text-white/60">{roomName}</span></h2>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)] animate-pulse"></span>
                                <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">{t('hud.connected')}</p>
                                {getIsHost() && saveStatus !== 'idle' && (
                                    <span className={`text-[10px] uppercase ml-1 ${saveStatus === 'saving' ? 'text-yellow-500' :
                                            saveStatus === 'saved' ? 'text-green-500' :
                                                saveStatus === 'error' ? 'text-red-500' : ''
                                        }`}>
                                        {saveStatus === 'saving' ? '⏳' : saveStatus === 'saved' ? '💾' : '❌'}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onLeave}
                        className="text-white/40 hover:text-red-400 p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        title={t('hud.leave')}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                    </button>
                </header>

                <button
                    onClick={onOpenDatabase}
                    className="pointer-events-auto bg-black/20 backdrop-blur-2xl p-4 rounded-xl shadow-2xl border border-white/10 flex items-center justify-between hover:bg-white/10 transition-colors cursor-pointer"
                >
                    <div className="flex items-center gap-3">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="m3 15 2 2 4-4" /></svg>
                        <span className="text-sm font-bold text-white/90 uppercase tracking-widest">База и Хаб</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transform transition-transform text-white/40 ${dbOpen ? 'translate-x-1' : ''}`}><polyline points="15 18 9 12 15 6" /></svg>
                </button>
            </div>
        </>
    );
}
