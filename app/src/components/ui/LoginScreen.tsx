import { useCallback, useState, useEffect } from 'react';
import i18next from 'i18next';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, FolderOpen, Loader2, Monitor, PlugZap, Server, Sparkles, UserRound } from 'lucide-react';
import { claimPlayerProfile, setIsHost, resetServerCache } from '../../services/fileApi';
import { loadWorld, onSyncProgress, onSyncStatus } from '../../services/fileSyncService';
import { isDesktopRuntime, openPreviewWorld, selectWorldFolder } from '../../services/desktopBridge';
import { StyleDemo } from '../ui-demo/StyleDemo';
import { glass } from '../../utils/theme';
import type { UserRole } from '../../types';

interface LoginScreenProps {
    onJoin: (roomName: string, playerName?: string, playerId?: string, role?: UserRole) => void;
}

type Step = 'main' | 'host' | 'join' | 'loading';
type ServerProbeStatus = 'idle' | 'checking' | 'online' | 'offline';

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

interface ServerProbeState {
    status: ServerProbeStatus;
    message: string;
    worldName?: string;
}

function readErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error || '');
}

function getHostWorldErrorMessage(error: unknown, isCreate: boolean, desktopRuntime: boolean): string {
    const raw = readErrorMessage(error);
    if (/failed to fetch|network|abort|timeout|timed out/i.test(raw)) {
        return desktopRuntime
            ? i18next.t('login.errors.desktopServerOffline')
            : i18next.t('login.errors.fileServerOffline');
    }
    if (/enoent|not found|no such file|cannot find/i.test(raw)) {
        return isCreate
            ? i18next.t('login.errors.createWorldPath')
            : i18next.t('login.errors.worldFolderMissing');
    }
    return raw || i18next.t('login.errors.openWorldFailed');
}

function getJoinServerErrorMessage(error: unknown, host: string): string {
    const raw = readErrorMessage(error);
    if (/ГМ ещё не открыл мир|ГМ еще не открыл мир|мир/i.test(raw)) return raw;
    if (/failed to fetch|network|abort|timeout|timed out/i.test(raw)) {
        return i18next.t('login.errors.joinServerNetwork', { host });
    }
    return i18next.t('login.errors.joinServerFallback', {
        error: raw || i18next.t('login.errors.connectionError'),
        host,
    });
}

function translateLoadStatus(message: string): string {
    if (/loading world/i.test(message)) return i18next.t('login.status.openingWorld');
    if (/world loaded/i.test(message)) return message.replace(/World loaded:/i, i18next.t('login.status.worldOpenedPrefix'));
    return message;
}

export function LoginScreen({ onJoin }: LoginScreenProps) {
    const { t } = useTranslation();
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
    const desktopRuntime = isDesktopRuntime();
    const [serverProbe, setServerProbe] = useState<ServerProbeState>({
        status: 'idle',
        message: desktopRuntime ? t('login.status.desktopServerPreparing') : t('login.status.serverProbeIdle'),
    });

    useEffect(() => {
        localStorage.setItem('vibe_saved_worlds', JSON.stringify(savedWorlds));
    }, [savedWorlds]);

    useEffect(() => {
        localStorage.setItem('vibe_saved_servers', JSON.stringify(savedServers));
    }, [savedServers]);

    const probeLocalServer = useCallback(async () => {
        setServerProbe({ status: 'checking', message: t('login.status.checkingLocalServer') });
        try {
            const res = await fetch('http://localhost:3001/api/world/status', {
                signal: AbortSignal.timeout(2500),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json() as { isOpen?: boolean; worldName?: string };
            setServerProbe({
                status: 'online',
                worldName: data.worldName,
                message: data.isOpen && data.worldName
                    ? t('login.status.serverOnlineWorld', { worldName: data.worldName })
                    : t('login.status.serverOnlineNoWorld'),
            });
        } catch (err) {
            setServerProbe({
                status: 'offline',
                message: getHostWorldErrorMessage(err, false, desktopRuntime),
            });
        }
    }, [desktopRuntime, t]);

    useEffect(() => {
        if (step !== 'host') return;
        void probeLocalServer();
    }, [probeLocalServer, step]);

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
    const handleOpenWorld = async (path: string, name: string, isCreate: boolean, options: { saveToRecent?: boolean } = {}) => {
        if (!path.trim()) return;

        setError('');
        setStep('loading');
        setLoadStatus(isCreate ? t('login.status.creatingWorld') : t('login.status.openingWorld'));

        onSyncProgress((loaded, total) => setLoadProgress({ loaded, total }));
        onSyncStatus((status, message) => {
            if (status === 'error') {
                setError(getHostWorldErrorMessage(message || 'Unknown error', isCreate, desktopRuntime));
                setStep('host');
            } else {
                setLoadStatus(translateLoadStatus(message || status));
            }
        });

        try {
            const meta = await loadWorld(path.trim(), {
                create: isCreate,
                worldName: isCreate ? name.trim() || 'New World' : undefined,
            });

            if (meta) {
                // Add to saved worlds if not exists
                if (options.saveToRecent !== false && !savedWorlds.some(w => w.path === path.trim())) {
                    setSavedWorlds([...savedWorlds, { name: meta.name, path: path.trim() }]);
                }

                // Clear server API settings to ensure local override
                localStorage.setItem('vibe_server_ip', '');
                localStorage.setItem('vibe_player_name', t('login.gmName'));

                // Auto-set room name from world name and connect
                const room = meta.name.toLowerCase().replace(/\s+/g, '-');
                setLoadStatus(t('login.status.worldOpened', { name: meta.name }));
                void probeLocalServer();
                setTimeout(() => onJoin(room, t('login.gmName')), 500); // Give small delay for UI
            }
        } catch (err) {
            setError(getHostWorldErrorMessage(err, isCreate, desktopRuntime));
            setStep('host');
        }
    };

    const handleDeleteSavedWorld = (path: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSavedWorlds(savedWorlds.filter(w => w.path !== path));
    };


    const handleOpenPreviewWorld = async () => {
        try {
            setError('');
            const previewPath = await openPreviewWorld();
            if (!previewPath) {
                setError(t('login.errors.previewWorldUnavailable'));
                return;
            }
            await handleOpenWorld(previewPath, t('login.previewWorld.name'), false, { saveToRecent: false });
        } catch (err) {
            setError(readErrorMessage(err) || t('login.errors.previewWorldUnavailable'));
            setStep('host');
        }
    };

    const handleSelectWorldFolder = async () => {
        try {
            const selectedPath = await selectWorldFolder();
            if (selectedPath) setWorldPath(selectedPath);
        } catch (err) {
            setError((err as Error).message);
        }
    };

    // ─── Step 2b: Join Server ───
    const handleJoinServer = async (ip: string, serverIdToUpdate?: string) => {
        const displayName = playerName.trim();
        if (!displayName) {
            setError(t('login.errors.enterPlayerName'));
            return;
        }

        setError('');
        setStep('loading');
        setLoadStatus(t('login.status.checkingServer', { host: ip || t('login.localServerLabel') }));

        const host = ip.trim() || window.location.hostname;
        try {
            // Test connection by fetching world status
            const res = await fetch(`http://${host}:3001/api/world/status`, {
                signal: AbortSignal.timeout(4000), // 4 sec timeout
            });

            if (!res.ok) throw new Error(t('login.errors.fileServerHttp', { status: res.status }));

            const data = await res.json();
            if (!data.isOpen || !data.worldName) {
                throw new Error(t('login.errors.serverOnlineNoWorld'));
            }

            setLoadStatus(t('login.status.connectingProfile', { worldName: data.worldName }));
            const roomName = data.worldName.toLowerCase().replace(/\s+/g, '-');
            const profile = await claimPlayerProfile(host, displayName, localStorage.getItem('vibe_player_id') || undefined);

            // Optionally update the lastRoom in saved servers
            if (serverIdToUpdate) {
                setSavedServers(prev => prev.map(s => s.id === serverIdToUpdate ? { ...s, lastRoom: roomName } : s));
            }

            localStorage.setItem('vibe_server_ip', ip.trim());
            localStorage.setItem('vibe_player_name', profile.displayName);
            localStorage.setItem('vibe_player_id', profile.playerId);
            onJoin(roomName, profile.displayName, profile.playerId, profile.assignedRole);
        } catch (err) {
            setError(getJoinServerErrorMessage(err, host));
            setStep('join');
        }
    };

    const handleSaveAndJoinServer = async (e: React.FormEvent) => {
        e.preventDefault();

        const displayName = playerName.trim();
        if (!displayName) {
            setError(t('login.errors.enterPlayerName'));
            return;
        }

        const newServer: SavedServer = {
            id: Date.now().toString(),
            label: newServerLabel.trim() || t('login.savedServerFallback', { host: newServerIp || t('login.localServerLabel') }),
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
                        <span className="text-2xl font-black text-white drop-shadow-md">E</span>
                    </div>
                </div>
                <h1 className="text-2xl font-bold mb-6 text-center bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
                    Eternity Table
                </h1>
                <div className="mb-5 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold text-white/45">
                        <Monitor size={12} />
                        {desktopRuntime ? t('login.runtime.desktop') : t('login.runtime.browser')}
                    </span>
                </div>

                {error && (
                    <div className="mb-4 flex gap-2 rounded-lg border border-red-700/50 bg-red-900/30 p-3 text-sm text-red-300 shadow-inner">
                        <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* ─── Main Menu ─── */}
                {step === 'main' && (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
                        <button
                            onClick={handleGoHost}
                            className="w-full bg-gradient-to-r from-emerald-600/60 to-cyan-600/60 hover:from-emerald-500/80 hover:to-cyan-500/80 text-white font-bold py-4 px-4 rounded-xl shadow-lg hover:shadow-emerald-500/25 transition-all outline-none flex items-center justify-center gap-3 border border-emerald-500/30"
                        >
                            <Server size={18} /> {t('login.hostWorldAsGm')}
                        </button>

                        <button
                            onClick={handleGoPlayer}
                            className="w-full bg-white/5 hover:bg-white/10 text-white/90 font-bold py-4 px-4 rounded-xl transition-all outline-none border border-white/10 flex items-center justify-center gap-3 shadow-inner hover:shadow-white/10"
                        >
                            <UserRound size={18} /> {t('login.joinAsPlayer')}
                        </button>

                        <div className="my-2 border-t border-white/5 w-1/2 mx-auto"></div>

                        <button
                            onClick={() => setShowDemo(true)}
                            className="w-full bg-transparent hover:bg-white/5 text-white/40 hover:text-white/70 font-medium py-3 px-4 rounded-xl transition-all border border-dashed border-white/20 text-sm flex items-center justify-center gap-2"
                        >
                            {t('login.uiDemo')}
                        </button>
                    </div>
                )}

                {/* ─── Host Menu ─── */}
                {step === 'host' && (
                    <div className="flex flex-col gap-5 animate-in slide-in-from-right-4 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-white/90">{t('login.worlds')}</h2>
                            <button onClick={() => { setStep('main'); setError(''); }} className="text-white/40 hover:text-white/80 p-1">
                                {t('common.back')}
                            </button>
                        </div>

                        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3 shadow-inner">
                            <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border ${
                                serverProbe.status === 'online'
                                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                                    : serverProbe.status === 'offline'
                                        ? 'border-red-400/30 bg-red-400/10 text-red-300'
                                        : 'border-white/10 bg-white/5 text-white/45'
                            }`}>
                                {serverProbe.status === 'checking'
                                    ? <Loader2 size={16} className="animate-spin" />
                                    : serverProbe.status === 'online'
                                        ? <CheckCircle2 size={16} />
                                        : <PlugZap size={16} />}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[10px] font-bold uppercase text-white/40">{t('login.localServer')}</div>
                                <div className="truncate text-xs text-white/72" title={serverProbe.message}>{serverProbe.message}</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => void probeLocalServer()}
                                className="h-8 flex-shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[10px] font-bold text-white/55 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                {t('login.checkServer')}
                            </button>
                        </div>


                        {desktopRuntime && (
                            <button
                                type="button"
                                onClick={() => void handleOpenPreviewWorld()}
                                className="flex w-full items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-400/10 p-3 text-left transition-colors hover:border-amber-300/35 hover:bg-amber-400/15"
                            >
                                <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-amber-300/25 bg-amber-300/10 text-amber-200">
                                    <Sparkles size={15} />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-amber-100">{t('login.previewWorld.open')}</div>
                                    <div className="mt-0.5 text-[11px] leading-snug text-amber-50/55">{t('login.previewWorld.description')}</div>
                                </div>
                            </button>
                        )}

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
                                            title={t('common.delete')}
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
                                <button onClick={() => setCreateMode(false)} className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${!createMode ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'}`}>{t('login.openWorld')}</button>
                                <button onClick={() => setCreateMode(true)} className={`flex-1 py-1.5 text-xs rounded-lg transition-all ${createMode ? 'bg-white/20 text-white' : 'text-white/40 hover:bg-white/10'}`}>{t('login.createWorld')}</button>
                            </div>

                            <form
                                onSubmit={(e) => { e.preventDefault(); handleOpenWorld(worldPath, worldName, createMode); }}
                                className="flex flex-col gap-3"
                            >
                                {createMode && (
                                    <input type="text" value={worldName} onChange={e => setWorldName(e.target.value)} className={`${glass.input} w-full text-sm`} placeholder={t('login.worldNamePlaceholder')} required />
                                )}
                                <div className="flex gap-2">
                                    <input type="text" value={worldPath} onChange={e => setWorldPath(e.target.value)} className={`${glass.input} min-w-0 flex-1 text-sm font-mono`} placeholder={createMode ? 'C:\\Games\\MyWorld' : t('login.worldPathPlaceholder')} required />
                                    {desktopRuntime && (
                                        <button
                                            type="button"
                                            onClick={handleSelectWorldFolder}
                                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-xs font-semibold text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                                        >
                                            <FolderOpen size={13} />
                                            {t('common.select')}
                                        </button>
                                    )}
                                </div>
                                <button type="submit" className="w-full mt-2 bg-gradient-to-r from-emerald-600/80 to-emerald-500/80 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all text-sm">
                                    {createMode ? t('login.createAndOpenWorld') : t('login.openWorld')}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* ─── Join Menu ─── */}
                {step === 'join' && (
                    <div className="flex flex-col gap-5 animate-in slide-in-from-left-4 duration-300">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-lg font-bold text-white/90">{t('login.connection')}</h2>
                            <button onClick={() => { setStep('main'); setError(''); }} className="text-white/40 hover:text-white/80 p-1">
                                {t('common.back')}
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
                                                <span className="bg-white/10 px-1 rounded">{t('login.ipLabel')}: {s.ip || t('login.localServerLabel')}</span>
                                                {s.lastRoom && <span className="bg-white/10 px-1 rounded">{t('login.worldLabel')}: {s.lastRoom}</span>}
                                            </div>
                                        </button>
                                        <button
                                            onClick={(e) => handleDeleteSavedServer(s.id, e)}
                                            className="w-10 bg-white/5 hover:bg-red-500/40 rounded-r-lg border-l border-white/5 flex items-center justify-center text-white/30 hover:text-white transition-colors"
                                            title={t('common.delete')}
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
                            <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest mb-3">{t('login.newConnection')}</h3>
                            <div className="mb-3">
                                <label className="text-[10px] text-white/40 mb-1 block px-1">{t('login.playerNameLabel')}</label>
                                <input type="text" value={playerName} onChange={e => { setPlayerName(e.target.value); localStorage.setItem('vibe_player_name', e.target.value); }} className={`${glass.input} w-full text-sm`} placeholder={t('login.playerNamePlaceholder')} />
                            </div>
                            <form onSubmit={handleSaveAndJoinServer} className="flex flex-col gap-3">
                                <div>
                                    <label className="text-[10px] text-white/40 mb-1 block px-1">{t('login.serverLabelName')}</label>
                                    <input type="text" value={newServerLabel} onChange={e => setNewServerLabel(e.target.value)} className={`${glass.input} w-full text-sm`} placeholder={t('login.serverLabelPlaceholder')} />
                                </div>
                                <div>
                                    <label className="text-[10px] text-white/40 mb-1 block px-1">{t('login.hostIpLabel')}</label>
                                    <input type="text" value={newServerIp} onChange={e => setNewServerIp(e.target.value)} className={`${glass.input} w-full text-sm font-mono`} placeholder={t('login.hostIpPlaceholder')} />
                                </div>
                                <button type="submit" className="w-full mt-2 bg-gradient-to-r from-cyan-600/80 to-blue-600/80 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2.5 rounded-lg shadow-lg transition-all text-sm">
                                    {t('login.saveAndConnect')}
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
                                    {t('login.loadingEntities', { loaded: loadProgress.loaded, total: loadProgress.total })}
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
            <p className="text-white/20 text-[10px] mt-4 font-mono select-none">{t('login.version')}</p>
        </div>
    );
}
