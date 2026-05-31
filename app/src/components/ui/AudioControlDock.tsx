import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Music, Pause, Play, SlidersHorizontal, Square, Volume2, X } from 'lucide-react';
import { getIsHost } from '../../services/fileApi';
import { useAudioSessionEnabled } from '../../hooks/useAudioSessionEnabled';
import { useAudioChannelVolumes } from '../../hooks/useAudioChannelVolumes';
import { yjsStore } from '../../store/yjsStore';
import { glass } from '../../utils/theme';
import type { AudioSessionCommand } from '../../types';
import { AudioDesk, type MusicPlaybackStatus, type MusicSeekRequest } from './AudioDesk';

const IDLE_MUSIC_STATUS: MusicPlaybackStatus = {
    isPlaying: false,
    currentTime: 0,
    duration: null,
    loop: false,
    volume: 0,
};

function formatPlayerTime(seconds: number | null | undefined): string {
    if (seconds == null || !Number.isFinite(seconds)) return '0:00';
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const rest = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
}

function isSessionAudioCommandActive(command: AudioSessionCommand | null): boolean {
    if (!command || command.action !== 'play') return false;
    const channel = command.channel ?? 'sfx';
    const ageMs = Date.now() - (command.startedAt ?? command.issuedAt);
    if (command.loop || channel === 'music' || channel === 'ambience') return ageMs < 6 * 60 * 60 * 1000;
    return ageMs < 30_000;
}

export function AudioControlDock() {
    const isHost = getIsHost();
    const [isOpen, setIsOpen] = useState(false);
    const [isCompact, setIsCompact] = useState(true);
    const [musicStatus, setMusicStatus] = useState<MusicPlaybackStatus>(IDLE_MUSIC_STATUS);
    const [musicSeekRequest, setMusicSeekRequest] = useState<MusicSeekRequest | null>(null);
    const [musicStopRequestId, setMusicStopRequestId] = useState<number | null>(null);
    const [musicPlayPauseRequestId, setMusicPlayPauseRequestId] = useState<number | null>(null);
    const [sessionAudioEnabled, setSessionAudioEnabled] = useAudioSessionEnabled();
    const [channelVolumes, setChannelVolume] = useAudioChannelVolumes();
    const [hasRemoteAudioCue, setHasRemoteAudioCue] = useState(false);

    useEffect(() => {
        if (isHost) return;

        const updateRemoteAudioCue = (command: AudioSessionCommand | null) => {
            setHasRemoteAudioCue(isSessionAudioCommandActive(command));
        };

        updateRemoteAudioCue(yjsStore.getLatestAudioCommand());
        return yjsStore.observeAudioCommands(updateRemoteAudioCue);
    }, [isHost]);

    const showEnablePulse = !isHost && !sessionAudioEnabled && hasRemoteAudioCue;
    const duration = musicStatus.duration ?? 0;
    const currentTime = Math.min(musicStatus.currentTime, duration || musicStatus.currentTime);
    const progressPercent = useMemo(() => {
        if (!duration) return 0;
        return Math.max(0, Math.min(100, (currentTime / duration) * 100));
    }, [currentTime, duration]);

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[45] flex flex-col items-center gap-3 px-4">
            <div
                className={`pointer-events-auto w-[min(920px,calc(100vw-32px))] overflow-hidden rounded-[var(--vibe-radius-lg)] transition-all ${glass.panel} ${
                    isOpen ? 'block' : 'hidden'
                }`}
            >
                <div className={`flex items-center justify-between gap-3 px-3 py-2.5 ${glass.panelHeader}`}>
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]">
                            <SlidersHorizontal size={16} />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-xs font-black uppercase tracking-wider text-[var(--vibe-text-primary)]">Пульт звука</div>
                            <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                Отдельный модуль: музыка, атмосфера, SFX
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] ${glass.iconButton}`}
                        title="Свернуть пульт"
                    >
                        <X size={15} />
                    </button>
                </div>
                <div className="h-[min(72vh,720px)] min-h-[320px] sm:min-h-[420px]">
                    <AudioDesk
                        onMusicPlaybackChange={setMusicStatus}
                        musicSeekRequest={musicSeekRequest}
                        musicStopRequestId={musicStopRequestId}
                        musicPlayPauseRequestId={musicPlayPauseRequestId}
                    />
                </div>
            </div>

            {isCompact && !isOpen ? (
                <button
                    type="button"
                    onClick={() => {
                        setIsCompact(false);
                        setIsOpen(true);
                    }}
                    className={`pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border backdrop-blur-[var(--vibe-backdrop-blur)] transition-all hover:scale-105 ${
                        showEnablePulse
                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-[var(--vibe-shadow-block)]'
                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-window)] text-[var(--vibe-text-muted)] shadow-[var(--vibe-shadow-block)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                    }`}
                    title={isHost ? 'Открыть пульт звука' : sessionAudioEnabled ? 'Звук сессии включён' : 'Включить звук сессии'}
                >
                    {showEnablePulse && (
                        <>
                            <span className="pointer-events-none absolute inset-[-6px] rounded-full border border-cyan-200/35 animate-ping" />
                            <span className="pointer-events-none absolute inset-[-13px] rounded-full border border-emerald-200/20 animate-pulse" />
                        </>
                    )}
                    <Music size={18} />
                </button>
            ) : (
            <div className={`pointer-events-auto flex w-[min(760px,calc(100vw-32px))] items-center gap-2 rounded-full px-2 py-2 ${glass.panel}`}>
                <button
                    type="button"
                    onClick={() => {
                        setIsOpen((current) => !current);
                        setIsCompact(false);
                    }}
                    className={`relative flex h-10 flex-shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-black uppercase tracking-wider transition-colors ${
                        showEnablePulse
                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] shadow-[var(--vibe-shadow-block)]'
                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)] hover:bg-[var(--vibe-surface-hover)]'
                    }`}
                    title={isOpen ? 'Скрыть пульт звука' : 'Открыть пульт звука'}
                >
                    {showEnablePulse && (
                        <>
                            <span className="pointer-events-none absolute inset-[-5px] rounded-full border border-cyan-200/35 animate-ping" />
                            <span className="pointer-events-none absolute inset-[-10px] rounded-full border border-emerald-200/20 animate-pulse" />
                        </>
                    )}
                    <Music size={16} />
                    {!isCompact && <span>Звук</span>}
                </button>

                {isHost ? (
                    <>
                        <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                            <button
                                type="button"
                                onClick={() => setMusicPlayPauseRequestId(Date.now())}
                                disabled={!musicStatus.cueId}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] transition-colors hover:bg-[var(--vibe-surface-hover)] disabled:cursor-not-allowed disabled:opacity-35"
                                title={musicStatus.isPlaying ? 'Пауза' : 'Продолжить'}
                            >
                                {musicStatus.isPlaying ? <Pause size={13} /> : <Play size={13} />}
                            </button>
                            <button
                                type="button"
                                onClick={() => setMusicStopRequestId(Date.now())}
                                disabled={!musicStatus.cueId}
                                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                                title="Остановить музыку"
                            >
                                <Square size={13} />
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                    <span className="truncate text-[var(--vibe-text-muted)]">
                                        {musicStatus.title ?? 'Музыка не запущена'}
                                    </span>
                                    <span className="flex-shrink-0 font-mono">
                                        {formatPlayerTime(currentTime)} / {formatPlayerTime(musicStatus.duration)}
                                    </span>
                                </div>
                                <div className="relative h-4">
                                    <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-[var(--vibe-surface-input)]">
                                        <div
                                            className="h-full rounded-full bg-[var(--vibe-accent)] shadow-[0_0_16px_color-mix(in_srgb,var(--vibe-accent)_24%,transparent)]"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <input
                                        type="range"
                                        min={0}
                                        max={duration || 100}
                                        step={0.25}
                                        value={duration ? currentTime : 0}
                                        disabled={!duration}
                                        onChange={(event) => setMusicSeekRequest({ id: Date.now(), seconds: Number(event.target.value) })}
                                        className="absolute inset-0 h-4 w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                                        title="Позиция трека"
                                    />
                                </div>
                            </div>
                            <div className="hidden w-28 flex-shrink-0 items-center gap-1.5 lg:flex">
                                <Volume2 size={13} className="text-[var(--vibe-text-faint)]" />
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={channelVolumes.music}
                                    onChange={(event) => setChannelVolume('music', Number(event.target.value))}
                                    className="h-1 w-full accent-[var(--vibe-accent)]"
                                    title="Громкость музыки"
                                />
                            </div>
                        </div>

                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden">
                            <button
                                type="button"
                                onClick={() => setMusicPlayPauseRequestId(Date.now())}
                                disabled={!musicStatus.cueId}
                                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] transition-colors disabled:opacity-35"
                            >
                                {musicStatus.isPlaying ? <Pause size={12} /> : <Play size={12} />}
                            </button>
                            <div className="min-w-0 flex-1">
                                <div className="truncate text-[9px] font-bold text-[var(--vibe-text-muted)]">
                                    {musicStatus.title ?? 'Музыка не запущена'}
                                </div>
                                {duration > 0 && (
                                    <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-[var(--vibe-surface-input)]">
                                        <div
                                            className="h-full rounded-full bg-[var(--vibe-accent)]"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
                            <Volume2 size={13} className={sessionAudioEnabled ? 'text-[var(--vibe-accent)]' : 'text-[var(--vibe-text-faint)]'} />
                            <span className="truncate text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                {sessionAudioEnabled ? 'Звук сессии включён' : showEnablePulse ? 'ГМ запустил звук' : 'Звук сессии выключен'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSessionAudioEnabled(!sessionAudioEnabled)}
                                className={`h-8 rounded-full border px-3 text-[10px] font-black uppercase tracking-wider transition-colors ${
                                    sessionAudioEnabled
                                        ? 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                        : 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)] hover:bg-[var(--vibe-surface-hover)]'
                                }`}
                            >
                                {sessionAudioEnabled ? 'Выключить' : 'Включить'}
                            </button>
                        </div>

                        <div className="flex min-w-0 flex-1 items-center gap-2 sm:hidden justify-between">
                            <span className="truncate text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                {sessionAudioEnabled ? 'Звук ВКЛ' : 'Звук ВЫКЛ'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setSessionAudioEnabled(!sessionAudioEnabled)}
                                className={`h-7 rounded-full border px-2.5 text-[9px] font-black uppercase tracking-wider transition-colors ${
                                    sessionAudioEnabled
                                        ? 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)]'
                                        : 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]'
                                }`}
                            >
                                {sessionAudioEnabled ? 'Выкл' : 'Вкл'}
                            </button>
                        </div>
                    </>
                )}

                {!isCompact && (
                    <>
                        <div className="hidden h-8 w-px bg-[var(--vibe-border-subtle)] sm:block" />
                        <div className="hidden min-w-0 items-center gap-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] sm:flex">
                            <Volume2 size={13} />
                            <span className="truncate">Сессионный аудио-модуль</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                setIsCompact(true);
                            }}
                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-[var(--vibe-text-faint)] transition-colors hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            title="Сжать до кнопки"
                        >
                            <ChevronDown size={16} />
                        </button>
                    </>
                )}
            </div>
            )}
        </div>
    );
}
