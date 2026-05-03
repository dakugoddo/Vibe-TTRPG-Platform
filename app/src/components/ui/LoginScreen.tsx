import { useState, useEffect } from 'react';
import { setIsHost, resetServerCache } from '../../services/fileApi';
import { loadWorld, onSyncProgress, onSyncStatus } from '../../services/fileSyncService';
import { StyleDemo } from '../ui-demo/StyleDemo';
import { glass } from '../../utils/theme';

interface LoginScreenProps {
    onJoin: (roomName: string) => void;
}

type Step = 'main' | 'host' | 'join' | 'loading';

interface SavedWorld {
    name: string;
    path: string;
}

interface SavedServer {
    id: string;
    label: string;
    ip: string;
    lastRoom?: string;
}

export function LoginScreen({ onJoin }: LoginScreenProps) {
    const [step, setStep] = useState<Step>('main');

    // Host States
    const [savedWorlds, setSavedWorlds] = useState<SavedWorld[]>(() => JSON.parse(localStorage.getItem('vibe_saved_worlds') || '[]'));
    const [createMode, setCreateMode] = useState(false);
    const [worldPath, setWorldPath] = useState('');
    const [worldName, setWorldName] = useState('');
    
    // Player States
    const [savedServers, setSavedServers] = useState<SavedServer[]>(() => JSON.parse(localStorage.getItem('vibe_saved_servers') || '[]'));
    const [newServerIp, setNewServerIp] = useState('');
    const [newServerLabel, setNewServerLabel] = useState('');
    const [playerName, setPlayerName] = useState(() => localStorage.getItem('vibe_player_name') || '');

    // Shared States
    const [loadProgress, setLoadProgress] = useState({ loaded: 0, total: 0 });
    const [loadStatus, setLoadStatus] = useState('');
    const [error, setError] = useState('');
    const [showDemo, setShowDemo] = useState(false);

    useEffect(() => {
        localStorage.setItem('vibe_saved_worlds', JSON.stringify(savedWorlds));
    }, [savedWorlds]);

    useEffect(() => {
        localStorage.setItem('vibe_saved_servers', JSON.stringify(savedServers));
    }, [savedServers]);

    // ─── Step 1: Main Menu ───
    const handleGoHost = () => {
        setIsHost(true);
        resetServerCache();
        setStep('host');
        setError('');
    };

    const handleGoPlayer = () => {
        setIsHost(false);
        setStep('join');
        setError('');
    };

    // ─── Step 2a: Host World ───
    const handleOpenWorld = async (path: string, name: string, isCreate: boolean) => {
        if (!path.trim()) return;

        setError('');
        setStep('loading');
        setLoadStatus('Opening world...');

        onSyncProgress((loaded, total) => setLoadProgress({ loaded, total }));
        onSyncStatus((status, message) => {
            if (status === 'error') {
                setError(message || 'Unknown error');
                setStep('host');
            } else {
                setLoadStatus(message || status);
            }
        });

        try {
            const meta = await loadWorld(path.trim(), {
                create: isCreate,
                worldName: isCreate ? name.trim() || 'New World' : undefined,
            });

            if (meta) {
                // Add to saved worlds if not exists
                if (!savedWorlds.some(w => w.path === path.trim())) {
                    setSavedWorlds([...savedWorlds, { name: meta.name, path: path.trim() }]);
                }
                
                // Clear server API settings to ensure local override
                localStorage.setItem('vibe_server_ip', '');
                localStorage.setItem('vibe_player_name', 'ГМ');
                
                // Auto-set room name from world name and connect
                const room = meta.name.toLowerCase().replace(/\s+/g, '-');
                setLoadStatus(`World loaded: ${meta.name}`);
                setTimeout(() => onJoin(room, 'ГМ'), 500); // Give small delay for UI
            }
        } catch (err) {
            setError((err as Error).message);
            setStep('host');
        }
    };

    const handleDeleteSavedWorld = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedWorlds(savedWorlds.filter(w => w.path !== path));
    };

    // ─── Step 2b: Join Server ───
    const handleJoinServer = async (ip: string, serverIdToUpdate?: string) => {
        const displayName = playerName.trim();
        if (!displayName) {
            setError('Пожалуйста, введите ваше имя перед подключением');
            return;
        }
        
        setError('');
        setStep('loading');
        setLoadStatus(`Подключение к ${ip || 'Локальному серверу'}...`);

        try {
            const host = ip.trim() || window.location.hostname;
            // Test connection by fetching world status
            const res = await fetch(`http://${host}:3001/api/world/status`, {
                signal: AbortSignal.timeout(4000), // 4 sec timeout
            });

            if (!res.ok) throw new Error(`Server returned ${res.status}`);
            
            const data = await res.json();
            if (!data.isOpen || !data.worldName) {
                throw new Error("Сервер онлайн, но Хост еще не запустил Вселенную!");
            }

            const roomName = data.worldName.toLowerCase().replace(/\s+/g, '-');

            // Optionally update the lastRoom in saved servers
            if (serverIdToUpdate) {
                setSavedServers(prev => prev.map(s => s.id === serverIdToUpdate ? { ...s, lastRoom: roomName } : s));
            }

            localStorage.setItem('vibe_server_ip', ip.trim());
                const displayName = playerName.trim() || 'Игрок';
                localStorage.setItem('vibe_player_name', displayName);
                onJoin(roomName, displayName);
        } catch (err) {
            setError(`Ошибка подключения к ${ip || 'Localhost'}. Сервер выключен, Хамачи не работает, или заблокирован Брандмауэром Windows.`);
            setStep('join');
        }
    };

    const handleSaveAndJoinServer = async (e: React.FormEvent) => {
        e.preventDefault();

        const displayName = playerName.trim();
        if (!displayName) {
            setError('Пожалуйста, введите ваше имя перед подключением');
            return;
        }

        const newServer: SavedServer = {
            id: Date.now().toString(),
            label: newServerLabel.trim() || `Сервер (${newServerIp || 'Локальный'})`,
            ip: newServerIp.trim()
        };

        // Don't add duplicate servers with the same IP
        if (!savedServers.some(s => s.ip === newServer.ip)) {
            setSavedServers([...savedServers, newServer]);
        }
        await handleJoinServer(newServer.ip, newServer.id);
    };

    const handleDeleteSavedServer = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedServers(savedServers.filter(s => s.id !== id));
    };

    return (
        <div className={`flex items-center justify-center min-h-screen ${glass.bg} text-white w-full flex-col p-4`}>
            <div className={`${glass.window} p-8 shrink-0 w-full max-w-md relative overflow-hidden z-10`}>
                
                {/* Header */}
                <div className="flex justify-center mb-6">
                    <div className="w-14 h-14 bg-gradient-to-br from-white/20 to-white/5 rounded-2xl shadow-lg shadow-white/50/10 flex items-center justify-center border border-white/20 backdrop-blur-xl">
                        <span className="text-2xl font-black text-white drop-shadow-md">V</span>
                    </div>
                </div>
                <h1 className="text-2xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    Vibe TTRPG
                </h1>

                {error && (
                    <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm shadow-inner">
                        ⚠️ {error}
                    </div>
                )}

                {/* ─── Main Menu ─── */}
                {step === 'main' && (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                        <button
                            onClick={handleGoHost}
                            className="w-full bg-gradient-to-r from-emerald-600/60 to-cyan-600/60 hover:from-emerald-500/80 hover:to-cyan-500/80 text-white font-bold py-4 px-4 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all outline-none flex items-center justify-center gap-3 border border-emerald-500/30"
                        >
                            <span className="text-xl">🌌</span> Хост Вселенной (Game Master)
                        </button>

                        <button
                            onClick={handleGoPlayer}
                            className="w-full bg-white/5 hover:bg-white/10 text-white/90 font-bold py-4 px-4 rounded-xl transition-all outline-none border border-white/10 flex items-center justify-center gap-3 shadow-inner hover:shadow-white/10"
                        >
                            <span className="text-xl">🔗</span> Подключиться к Игре (Player)
                        </button>

                        <div className="my-2 border-t border-white/5 w-1/2 mx-auto"></div>

                        <button
                            onClick={() => setShowDemo(true)}
                            className="w-full bg-transparent hover:bg-white/5 text-white/40 hover:text-white/70 font-medium py-3 px-4 rounded-xl transition-all border border-dashed border-white/20 text-sm flex items-center justify-center gap-2"
                        >
                            💅 Демонстрация стилей UI
                        </button>
                    </div>
                )}

                {/* ─── Host Menu ─── */}
                {step === 'host' && (
                    <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-white/90">Вселенные</h2>
                            <button onClick={() => { setStep('main'); setError(''); }} className="text-white/40 hover:text-white/80 p-1">
                                ↺ Назад
                            </button>
                        </div>

                        {/* Saved Worlds List */}
                        {savedWorlds.length > 0 && (
                            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                {savedWorlds.map(w => (
                                    <div key={w.path} className="flex group relative">
                                        <button 
                                            onClick={() => handleOpenWorld(w.path, w.name, false)}
                                            className="flex-1 text-left p-3 rounded-l-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-emerald-500/30 transition-all truncate group-hover:bg-emerald-900/20"
                                        >
                                            <div className="font-bold text-sm text-emerald-400 truncate">{w.name}</div>
                                            <div className="text-[10px] text-white/30 font-mono truncate mt-0.5">{w.path}</div>
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeleteSavedWorld(w.path, e)}
                                            className="w-10 bg-white/5 hover:bg-red-500/40 rounded-r-lg border-l border-white/5 flex items-center justify-center text-white/30 hover:text-white transition-colors"
                                            title="Удалить"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-white/10 my-1"></div>

                        {/* Create / Open New */}
                        <div className="bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                            <div className="flex gap-2 mb-4">
                                <button onClick={() => setCreateMode(false)} className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${!createMode ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'}`}>📂 Открыть существующую</button>
                                <button onClick={() => setCreateMode(true)} className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${createMode ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'}`}>✨ Создать новую</button>
                            </div>
                            
                            <form 
                                onSubmit={(e) => { e.preventDefault(); handleOpenWorld(worldPath, worldName, createMode); }}
                                className="flex flex-col gap-3"
                            >
                                {createMode && (
                                    <input type="text" value={worldName} onChange={e => setWorldName(e.target.value)} className={`${glass.input} w-full text-sm`} placeholder="Название вселенной" required />
                                )}
                                <input type="text" value={worldPath} onChange={e => setWorldPath(e.target.value)} className={`${glass.input} w-full text-sm font-mono`} placeholder={createMode ? 'C:\\Games\\MyTTRPG' : 'Путь к папке мира'} required />
                                <button type="submit" className="w-full mt-2 bg-gradient-to-r from-emerald-600/80 to-emerald-500/80 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all text-sm">
                                    {createMode ? 'Запустить новую Вселенную' : 'Запустить сервер'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ─── Join Menu ─── */}
                {step === 'join' && (
                    <div className="flex flex-col gap-5 animate-in slide-in-from-left-4 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-white/90">Подключение</h2>
                            <button onClick={() => { setStep('main'); setError(''); }} className="text-white/40 hover:text-white/80 p-1">
                                ↺ Назад
                            </button>
                        </div>

                        {/* Saved Servers List */}
                        {savedServers.length > 0 && (
                            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1 custom-scrollbar">
                                {savedServers.map(s => (
                                    <div key={s.id} className="flex group relative">
                                        <button 
                                            onClick={() => handleJoinServer(s.ip, s.id)}
                                            className="flex-1 text-left p-3 rounded-l-lg bg-white/5 hover:bg-white/10 border border-transparent hover:border-cyan-500/30 transition-all truncate flex flex-col group-hover:bg-cyan-900/20"
                                        >
                                            <div className="font-bold text-sm text-cyan-400 truncate">{s.label}</div>
                                            <div className="flex items-center gap-2 mt-0.5 text-white/40 text-[10px] font-mono">
                                                <span className="bg-white/10 px-1 rounded">IP: {s.ip || 'Локальный'}</span>
                                                {s.lastRoom && <span className="bg-white/10 px-1 rounded">Мир: {s.lastRoom}</span>}
                                            </div>
                                        </button>
                                        <button 
                                            onClick={(e) => handleDeleteSavedServer(s.id, e)}
                                            className="w-10 bg-white/5 hover:bg-red-500/40 rounded-r-lg border-l border-white/5 flex items-center justify-center text-white/30 hover:text-white transition-colors"
                                            title="Удалить"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="border-t border-white/10 my-1"></div>

                        {/* Connect to New Server */}
                        <div className="bg-black/20 p-4 rounded-xl border border-white/5 shadow-inner">
                            <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">Новое подключение</h3>
                            <div className="mb-3">
                                <label className="text-[10px] text-white/40 mb-1 block px-1">Ваше имя (будет видно в чате и ГМу)</label>
                                <input type="text" value={playerName} onChange={e => { setPlayerName(e.target.value); localStorage.setItem('vibe_player_name', e.target.value); }} className={`${glass.input} w-full text-sm`} placeholder="Введите имя персонажа или ник" />
                            </div>
                            <form onSubmit={handleSaveAndJoinServer} className="flex flex-col gap-3">
                                <div>
                                    <label className="text-[10px] text-white/40 mb-1 block px-1">Название (для сохранения)</label>
                                    <input type="text" value={newServerLabel} onChange={e => setNewServerLabel(e.target.value)} className={`${glass.input} w-full text-sm`} placeholder="Например: Сервер Влада" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-white/40 mb-1 block px-1">IP-адрес Хоста</label>
                                    <input type="text" value={newServerIp} onChange={e => setNewServerIp(e.target.value)} className={`${glass.input} w-full text-sm font-mono`} placeholder="Например: 26.54.12.3 (пусто для Local)" />
                                </div>
                                <button type="submit" className="w-full mt-2 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all text-sm">
                                    Сохранить и Подключиться
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ─── Loading ─── */}
                {step === 'loading' && (
                    <div className="flex flex-col items-center justify-center gap-4 py-8 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-12 h-12 border-4 border-white/5 border-t-emerald-400 rounded-full animate-spin shadow-[0_0_15px_rgba(52,211,153,0.3)]"></div>
                        <p className="text-emerald-400 font-medium text-sm animate-pulse">{loadStatus}</p>
                        {loadProgress.total > 0 && (
                            <div className="w-full mt-2">
                                <div className="w-full bg-black/40 rounded-full h-1.5 shadow-inner overflow-hidden">
                                    <div
                                        className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${(loadProgress.loaded / loadProgress.total) * 100}%` }}
                                    ></div>
                                </div>
                                <p className="text-[10px] text-white/30 mt-2 text-center font-mono opacity-50">
                                    Загрузка сущностей: {loadProgress.loaded} / {loadProgress.total}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {showDemo && <StyleDemo onClose={() => setShowDemo(false)} />}

            {/* Background elements */}
            {step === 'main' && (
                <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden opacity-30 mix-blend-screen">
                    <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px]"></div>
                    <div className="absolute bottom-1/4 right-1/4 w-[600px] h-[600px] bg-cyan-600/20 rounded-full blur-[150px]"></div>
                </div>
            )}
            {/* Version */}
            <p className="text-white/20 text-[10px] mt-4 font-mono select-none">v0.2.0 — entity file system</p>
        </div>
    );
}
