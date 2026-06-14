import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import { Headphones, Music, Play, Plus, Radio, RefreshCw, SlidersHorizontal, Square, Trash2, Upload, Volume2, VolumeX } from 'lucide-react';
import { getAssetUrl, getIsHost, listAssetRecords, uploadAssetFile, getAudioDeck, saveAudioDeck, type AssetRecord } from '../../services/fileApi';
import { normalizeAudioFadeMs, shouldUseBufferedPlayback, startBufferedSfxPlayback, startMediaPlayback, type AudioPlaybackHandle, type MediaPlaybackHandle } from '../../services/audioPlayback';
import { useAudioChannelVolumes } from '../../hooks/useAudioChannelVolumes';
import { useAudioSessionEnabled } from '../../hooks/useAudioSessionEnabled';
import { normalizeAudioCue, normalizeAudioDeckState, type AudioCue, type AudioCueMode, type AudioDeckState } from '../../utils/audioDeckModel';
import { yjsStore } from '../../store/yjsStore';
import { useNotificationStore } from '../../store/notificationStore';
import { LARGE_ASSET_UPLOAD_APPROVAL_BYTES, formatNotificationFileSize } from '../../utils/notificationModel';
import { glass } from '../../utils/theme';
import type { AudioChannel } from '../../types';

type AudioAsset = AssetRecord & {
    path: string;
    relativePath: string;
    url: string;
};

const AUDIO_DECK_STORAGE_KEY = 'vibe_audio_deck_state';
const AUDIO_DECK_BROADCAST_KEY = 'vibe_audio_desk_broadcast';
const AUDIO_DECK_FADE_KEY = 'vibe_audio_desk_fade_ms';
const MAX_AUDIO_UPLOAD_BYTES = 250 * 1024 * 1024;
const audioShellClass = 'flex h-full flex-col bg-[var(--vibe-surface-block)]';
const audioPanelClass = 'rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3 shadow-[var(--vibe-shadow-block)]';
const audioTitleClass = 'text-[10px] font-black uppercase tracking-wider text-[var(--vibe-text-faint)]';
const audioIconClass = 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]';
const audioButtonClass = 'flex items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';
const audioDangerButtonClass = 'border-[color-mix(in_srgb,var(--vibe-danger)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] text-[var(--vibe-danger)] hover:bg-[color-mix(in_srgb,var(--vibe-danger)_20%,transparent)]';
const audioActiveClass = 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]';
const audioIdleClass = 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';

const CHANNELS: Array<{ id: AudioChannel; label: string; shortLabel: string }> = [
    { id: 'music', label: 'Музыка', shortLabel: 'MUS' },
    { id: 'ambience', label: 'Атмосфера', shortLabel: 'AMB' },
    { id: 'sfx', label: 'SFX', shortLabel: 'SFX' },
    { id: 'voice', label: 'Голос', shortLabel: 'VOX' },
];

export interface MusicPlaybackStatus {
    isPlaying: boolean;
    cueId?: string;
    title?: string;
    channel?: AudioChannel;
    sessionMode?: 'local' | 'session';
    error?: string | null;
    currentTime: number;
    duration: number | null;
    loop: boolean;
    volume: number;
}

export interface MusicSeekRequest {
    id: number;
    seconds: number;
}

interface AudioDeskProps {
    onMusicPlaybackChange?: (status: MusicPlaybackStatus) => void;
    musicSeekRequest?: MusicSeekRequest | null;
    musicStopRequestId?: number | null;
    musicPlayPauseRequestId?: number | null;
    stopAllRequestId?: number | null;
    chrome?: 'full' | 'compact';
}

function getIdleMusicStatus(): MusicPlaybackStatus {
    return {
        isPlaying: false,
        channel: 'music',
        currentTime: 0,
        duration: null,
        loop: false,
        volume: 0,
        error: null,
    };
}

function isMediaPlaybackHandle(handle: AudioPlaybackHandle | undefined): handle is MediaPlaybackHandle {
    return Boolean(handle && 'element' in handle);
}

function loadAudioDeckState(): AudioDeckState {
    if (typeof window === 'undefined') return normalizeAudioDeckState(null);
    try {
        return normalizeAudioDeckState(JSON.parse(window.localStorage.getItem(AUDIO_DECK_STORAGE_KEY) || '{}'));
    } catch {
        return normalizeAudioDeckState(null);
    }
}

function saveAudioDeckState(deckState: AudioDeckState): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDIO_DECK_STORAGE_KEY, JSON.stringify(deckState));
}

function getStoredFadeMs(): number {
    if (typeof window === 'undefined') return 1000;
    return normalizeAudioFadeMs(Number(window.localStorage.getItem(AUDIO_DECK_FADE_KEY) || 1000));
}

function getDefaultCueMode(channel: AudioChannel): AudioCueMode {
    if (channel === 'music') return 'track';
    if (channel === 'ambience') return 'loop';
    return 'oneshot';
}

function getDefaultLoop(channel: AudioChannel): boolean {
    return channel === 'ambience';
}

function normalizeAudioAsset(asset: AssetRecord): AudioAsset {
    const path = asset.path || asset.relativePath || asset.name;
    return {
        ...asset,
        path,
        relativePath: asset.relativePath || path,
        url: asset.url || getAssetUrl(path),
    };
}

function isAudioUploadFile(file: File): boolean {
    if (file.type.startsWith('audio/')) return true;
    return /\.(mp3|wav|ogg|flac|m4a|aac)$/i.test(file.name);
}

function getChannelLabel(channel: AudioChannel): string {
    return CHANNELS.find(item => item.id === channel)?.label ?? channel;
}

function getCueModeLabel(mode: AudioCueMode): string {
    if (mode === 'track') return 'Трек';
    if (mode === 'loop') return 'Петля';
    return 'Разово';
}

export function AudioDesk({
    onMusicPlaybackChange,
    musicSeekRequest,
    musicStopRequestId,
    musicPlayPauseRequestId,
    stopAllRequestId,
    chrome = 'full',
}: AudioDeskProps = {}) {
    const isHost = getIsHost();
    const [assets, setAssets] = useState<AudioAsset[]>([]);
    const [deckState, setDeckState] = useState<AudioDeckState>(loadAudioDeckState);
    const [activeChannel, setActiveChannel] = useState<AudioChannel>('sfx');
    const [query, setQuery] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [syncToPlayers, setSyncToPlayers] = useState(() => window.localStorage.getItem(AUDIO_DECK_BROADCAST_KEY) === 'true');
    const [fadeMs, setFadeMs] = useState(getStoredFadeMs);
    const [playingByChannel, setPlayingByChannel] = useState<Partial<Record<AudioChannel, string>>>({});
    const [playingAmbienceCueIds, setPlayingAmbienceCueIds] = useState<string[]>([]);
    const playbackByChannelRef = useRef<Partial<Record<AudioChannel, AudioPlaybackHandle>>>({});
    const ambiencePlaybackByCueRef = useRef<Record<string, AudioPlaybackHandle>>({});
    const lastMusicSeekRequestIdRef = useRef<number | null>(null);
    const lastMusicStopRequestIdRef = useRef<number | null>(null);
    const lastMusicPlayPauseRequestIdRef = useRef<number | null>(null);
    const lastStopAllRequestIdRef = useRef<number | null>(null);
    const hasLoadedFromServer = useRef(false);
    const [sessionAudioEnabled, setSessionAudioEnabled] = useAudioSessionEnabled();
    const [channelVolumes, setChannelVolume] = useAudioChannelVolumes();
    const addNotification = useNotificationStore((state) => state.addNotification);
    const updateNotification = useNotificationStore((state) => state.updateNotification);
    const updateNotificationProgress = useNotificationStore((state) => state.updateProgress);
    const isCompactChrome = chrome === 'compact';

    const loadAssets = useCallback(async (): Promise<AudioAsset[]> => {
        if (!isHost) return [];
        setIsLoading(true);
        setError(null);
        try {
            const records = await listAssetRecords();
            const nextAssets = records.filter(asset => asset.type === 'audio').map(normalizeAudioAsset);
            setAssets(nextAssets);
            return nextAssets;
        } catch (err) {
            setError((err as Error).message);
            setAssets([]);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [isHost]);

    useEffect(() => {
        void loadAssets();
    }, [loadAssets]);

    useEffect(() => {
        async function fetchDeck() {
            if (!isHost) {
                hasLoadedFromServer.current = true;
                return;
            }
            try {
                const data = await getAudioDeck();
                if (data && ((data.cues?.length ?? 0) > 0 || (data.playlists?.length ?? 0) > 0 || (data.scenes?.length ?? 0) > 0)) {
                    setDeckState(normalizeAudioDeckState(data));
                }
            } catch (err) {
                console.warn('Failed to load audio deck from host:', err);
            } finally {
                hasLoadedFromServer.current = true;
            }
        }
        void fetchDeck();
    }, [isHost]);

    useEffect(() => {
        saveAudioDeckState(deckState);
        if (isHost && hasLoadedFromServer.current) {
            void saveAudioDeck(deckState);
        }
    }, [deckState, isHost]);

    useEffect(() => {
        window.localStorage.setItem(AUDIO_DECK_BROADCAST_KEY, syncToPlayers ? 'true' : 'false');
    }, [syncToPlayers]);

    useEffect(() => {
        window.localStorage.setItem(AUDIO_DECK_FADE_KEY, String(fadeMs));
    }, [fadeMs]);

    useEffect(() => {
        return () => {
            Object.values(playbackByChannelRef.current).forEach(handle => handle?.stop());
            playbackByChannelRef.current = {};
            Object.values(ambiencePlaybackByCueRef.current).forEach(handle => handle?.stop());
            ambiencePlaybackByCueRef.current = {};
        };
    }, []);

    const audioAssetsById = useMemo(() => new Map(assets.map(asset => [asset.id, asset])), [assets]);

    const visibleAssets = useMemo(() => {
        const normalizedQuery = query.trim().toLowerCase();
        return assets
            .filter(asset => !normalizedQuery
                || asset.name.toLowerCase().includes(normalizedQuery)
                || asset.path.toLowerCase().includes(normalizedQuery))
            .sort((left, right) => left.name.localeCompare(right.name, 'ru'));
    }, [assets, query]);

    const cuesForActiveChannel = useMemo(() => {
        return deckState.cues.filter(cue => cue.channel === activeChannel);
    }, [activeChannel, deckState.cues]);

    const updateDeckState = useCallback((updater: (current: AudioDeckState) => AudioDeckState) => {
        setDeckState(current => normalizeAudioDeckState(updater(current)));
    }, []);

    const publishIdleMusicStatus = useCallback(() => {
        onMusicPlaybackChange?.({
            ...getIdleMusicStatus(),
            sessionMode: syncToPlayers ? 'session' : 'local',
        });
    }, [onMusicPlaybackChange, syncToPlayers]);

    const publishMusicError = useCallback((title: string, message: string) => {
        onMusicPlaybackChange?.({
            ...getIdleMusicStatus(),
            title,
            sessionMode: syncToPlayers ? 'session' : 'local',
            error: message,
        });
    }, [onMusicPlaybackChange, syncToPlayers]);

    const addCueFromAsset = useCallback((asset: AudioAsset) => {
        const cue = normalizeAudioCue({
            id: `cue-${Date.now()}-${asset.id}`,
            assetId: asset.id,
            assetPath: asset.path,
            assetName: asset.name,
            channel: activeChannel,
            mode: getDefaultCueMode(activeChannel),
            loop: getDefaultLoop(activeChannel),
            fadeMs,
            volume: 0.75,
        });
        if (!cue) return;

        updateDeckState(current => ({
            ...current,
            cues: [cue, ...current.cues.filter(existingCue => existingCue.id !== cue.id)],
        }));
    }, [activeChannel, fadeMs, updateDeckState]);

    const handleAudioDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
        if (!isHost) return;
        event.preventDefault();
        event.stopPropagation();

        const files = Array.from(event.dataTransfer.files || []).filter(isAudioUploadFile);
        if (files.length === 0) return;

        setError(null);
        try {
            for (const file of files) {
                if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
                    throw new Error(`Файл "${file.name}" больше 250 MB. Для таких файлов нужен отдельный approval/upload flow.`);
                }

                const isLargeUpload = file.size > LARGE_ASSET_UPLOAD_APPROVAL_BYTES;
                const uploadNotification = addNotification({
                    kind: 'progress',
                    scope: 'local',
                    status: 'pending',
                    title: isLargeUpload ? 'Крупный аудиофайл' : 'Загрузка аудио',
                    message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                    progress: 0,
                    payload: {
                        fileName: file.name,
                        size: file.size,
                        requiresGmApproval: isLargeUpload,
                    },
                });

                try {
                    const uploaded = await uploadAssetFile(file, {
                        onProgress: (progress) => updateNotificationProgress(uploadNotification.id, progress.percent),
                    });
                    updateNotification(uploadNotification.id, {
                        kind: 'success',
                        status: 'done',
                        title: 'Аудио загружено',
                        message: `${file.name} • ${formatNotificationFileSize(file.size)}`,
                        progress: 100,
                    });

                    const nextAssets = await loadAssets();
                    const uploadedAsset = nextAssets.find(asset => asset.path === uploaded.filename || asset.relativePath === uploaded.filename);
                    if (uploadedAsset) addCueFromAsset(uploadedAsset);
                } catch (err) {
                    updateNotification(uploadNotification.id, {
                        kind: 'error',
                        status: 'failed',
                        title: 'Загрузка аудио не удалась',
                        message: `${file.name}: ${(err as Error).message}`,
                    });
                    throw err;
                }
            }
        } catch (err) {
            setError((err as Error).message);
        }
    }, [addCueFromAsset, addNotification, isHost, loadAssets, updateNotification, updateNotificationProgress]);

    const stopChannel = useCallback((channel: AudioChannel, shouldBroadcast = true) => {
        if (channel === 'ambience') {
            Object.values(ambiencePlaybackByCueRef.current).forEach(handle => handle.stop(fadeMs));
            ambiencePlaybackByCueRef.current = {};
            delete playbackByChannelRef.current.ambience;
            setPlayingAmbienceCueIds([]);
        } else {
            playbackByChannelRef.current[channel]?.stop(fadeMs);
            delete playbackByChannelRef.current[channel];
        }
        setPlayingByChannel(current => ({ ...current, [channel]: undefined }));
        if (channel === 'music') publishIdleMusicStatus();

        if (shouldBroadcast && syncToPlayers) {
            yjsStore.sendAudioCommand({
                action: 'stop',
                assetId: `channel:${channel}`,
                assetPath: '',
                assetName: getChannelLabel(channel),
                channel,
                volume: 0,
                fadeMs,
            });
        }
    }, [fadeMs, publishIdleMusicStatus, syncToPlayers]);

    const stopAmbienceCue = useCallback((cue: AudioCue, shouldBroadcast = true) => {
        ambiencePlaybackByCueRef.current[cue.id]?.stop(fadeMs);
        delete ambiencePlaybackByCueRef.current[cue.id];
        setPlayingAmbienceCueIds(current => current.filter(id => id !== cue.id));
        setPlayingByChannel(current => current.ambience === cue.id ? { ...current, ambience: undefined } : current);

        if (shouldBroadcast && syncToPlayers) {
            yjsStore.sendAudioCommand({
                action: 'stop',
                assetId: cue.id,
                assetPath: cue.assetPath,
                assetName: cue.assetName,
                channel: 'ambience',
                volume: 0,
                fadeMs,
            });
        }
    }, [fadeMs, syncToPlayers]);

    const removeCue = useCallback((cueId: string) => {
        const cue = deckState.cues.find(item => item.id === cueId);
        if (cue?.channel === 'ambience' && playingAmbienceCueIds.includes(cue.id)) {
            stopAmbienceCue(cue);
        } else if (cue && playingByChannel[cue.channel] === cue.id) {
            playbackByChannelRef.current[cue.channel]?.stop(fadeMs);
            delete playbackByChannelRef.current[cue.channel];
            setPlayingByChannel(current => ({ ...current, [cue.channel]: undefined }));
        }

        updateDeckState(current => ({
            ...current,
            cues: current.cues.filter(item => item.id !== cueId),
            playlists: current.playlists.map(playlist => ({
                ...playlist,
                cueIds: playlist.cueIds.filter(id => id !== cueId),
            })),
            scenes: current.scenes.map(scene => ({
                ...scene,
                cueIds: scene.cueIds.filter(id => id !== cueId),
            })),
        }));
    }, [deckState.cues, fadeMs, playingAmbienceCueIds, playingByChannel, stopAmbienceCue, updateDeckState]);

    useEffect(() => {
        if (musicStopRequestId == null || lastMusicStopRequestIdRef.current === musicStopRequestId) return;
        lastMusicStopRequestIdRef.current = musicStopRequestId;
        stopChannel('music');
    }, [musicStopRequestId, stopChannel]);

    useEffect(() => {
        if (musicPlayPauseRequestId == null || lastMusicPlayPauseRequestIdRef.current === musicPlayPauseRequestId) return;
        lastMusicPlayPauseRequestIdRef.current = musicPlayPauseRequestId;

        const musicHandle = playbackByChannelRef.current.music;
        if (!isMediaPlaybackHandle(musicHandle)) return;
        const cueId = playingByChannel.music;
        const musicCue = cueId ? deckState.cues.find(cue => cue.id === cueId) : null;

        if (musicHandle.element.paused) {
            void musicHandle.resume?.();
            if (musicCue && syncToPlayers) {
                yjsStore.sendAudioCommand({
                    action: 'play',
                    assetId: musicCue.assetId,
                    assetPath: musicCue.assetPath,
                    assetName: musicCue.assetName,
                    channel: 'music',
                    volume: musicCue.volume,
                    duration: null,
                    loop: musicCue.loop,
                    fadeMs: 0,
                    startedAt: Date.now() - Math.max(0, musicHandle.element.currentTime || 0) * 1000,
                });
            }
        } else {
            musicHandle.pause?.();
            if (syncToPlayers) {
                yjsStore.sendAudioCommand({
                    action: 'stop',
                    assetId: 'channel:music',
                    assetPath: '',
                    assetName: getChannelLabel('music'),
                    channel: 'music',
                    volume: 0,
                    fadeMs: 0,
                });
            }
        }
    }, [deckState.cues, musicPlayPauseRequestId, playingByChannel.music, syncToPlayers]);

    useEffect(() => {
        if (!musicSeekRequest || lastMusicSeekRequestIdRef.current === musicSeekRequest.id) return;
        lastMusicSeekRequestIdRef.current = musicSeekRequest.id;

        const musicHandle = playbackByChannelRef.current.music;
        if (!isMediaPlaybackHandle(musicHandle)) return;

        const duration = Number.isFinite(musicHandle.element.duration) && musicHandle.element.duration > 0
            ? musicHandle.element.duration
            : null;
        musicHandle.element.currentTime = Math.max(0, Math.min(musicSeekRequest.seconds, duration ?? musicSeekRequest.seconds));
    }, [musicSeekRequest]);

    const stopAll = useCallback(() => {
        CHANNELS.forEach(channel => stopChannel(channel.id, false));
        if (syncToPlayers) {
            yjsStore.sendAudioCommand({
                action: 'stop',
                assetId: 'all',
                assetPath: '',
                assetName: 'Все каналы',
                volume: 0,
                fadeMs,
            });
        }
    }, [fadeMs, stopChannel, syncToPlayers]);

    useEffect(() => {
        if (stopAllRequestId == null || lastStopAllRequestIdRef.current === stopAllRequestId) return;
        lastStopAllRequestIdRef.current = stopAllRequestId;
        stopAll();
    }, [stopAll, stopAllRequestId]);

    useEffect(() => {
        if (!onMusicPlaybackChange) return;

        const cueId = playingByChannel.music;
        const musicCue = cueId ? deckState.cues.find(cue => cue.id === cueId) : null;
        const musicHandle = playbackByChannelRef.current.music;

        if (!musicCue || !isMediaPlaybackHandle(musicHandle)) {
            publishIdleMusicStatus();
            return;
        }

        const syncStatus = () => {
            const duration = Number.isFinite(musicHandle.element.duration) && musicHandle.element.duration > 0
                ? musicHandle.element.duration
                : null;
            onMusicPlaybackChange({
                isPlaying: !musicHandle.element.paused,
                cueId: musicCue.id,
                title: musicCue.label ?? musicCue.assetName,
                channel: 'music',
                sessionMode: syncToPlayers ? 'session' : 'local',
                error: null,
                currentTime: Math.max(0, musicHandle.element.currentTime || 0),
                duration,
                loop: musicCue.loop,
                volume: musicCue.volume,
            });
        };

        syncStatus();
        musicHandle.element.addEventListener('timeupdate', syncStatus);
        musicHandle.element.addEventListener('loadedmetadata', syncStatus);
        musicHandle.element.addEventListener('play', syncStatus);
        musicHandle.element.addEventListener('pause', syncStatus);
        const intervalId = window.setInterval(syncStatus, 500);

        return () => {
            musicHandle.element.removeEventListener('timeupdate', syncStatus);
            musicHandle.element.removeEventListener('loadedmetadata', syncStatus);
            musicHandle.element.removeEventListener('play', syncStatus);
            musicHandle.element.removeEventListener('pause', syncStatus);
            window.clearInterval(intervalId);
        };
    }, [deckState.cues, onMusicPlaybackChange, playingByChannel.music, publishIdleMusicStatus, syncToPlayers]);

    const playCue = useCallback((cue: AudioCue) => {
        const asset = audioAssetsById.get(cue.assetId);
        if (!asset) {
            const message = `Файл не найден: ${cue.assetName}`;
            setError(message);
            if (cue.channel === 'music') publishMusicError(cue.label ?? cue.assetName, message);
            return;
        }

        setError(null);
        if (cue.channel === 'ambience') {
            ambiencePlaybackByCueRef.current[cue.id]?.stop(cue.fadeMs);
            delete ambiencePlaybackByCueRef.current[cue.id];
            setPlayingAmbienceCueIds(current => current.filter(id => id !== cue.id));
        } else {
            stopChannel(cue.channel, false);
        }
        const startedAt = Date.now();
        const clearCuePlayback = () => {
            if (cue.channel === 'ambience') {
                delete ambiencePlaybackByCueRef.current[cue.id];
                setPlayingAmbienceCueIds(current => current.filter(id => id !== cue.id));
                setPlayingByChannel(current => current.ambience === cue.id ? { ...current, ambience: undefined } : current);
                return;
            }
            setPlayingByChannel(current => current[cue.channel] === cue.id ? { ...current, [cue.channel]: undefined } : current);
            delete playbackByChannelRef.current[cue.channel];
        };
        const playbackOptions = {
            url: asset.url,
            volume: cue.volume,
            channel: cue.channel,
            loop: cue.loop,
            fadeInMs: cue.fadeMs,
            onEnded: clearCuePlayback,
            onError: () => {
                const message = `Не удалось воспроизвести: ${cue.assetName}`;
                setError(message);
                if (cue.channel === 'music') publishMusicError(cue.label ?? cue.assetName, message);
                clearCuePlayback();
            },
        };
        const handle = cue.mode === 'oneshot' && shouldUseBufferedPlayback(null, asset.size)
            ? startBufferedSfxPlayback(playbackOptions)
            : startMediaPlayback(playbackOptions);

        if (cue.channel === 'ambience') {
            ambiencePlaybackByCueRef.current[cue.id] = handle;
            setPlayingAmbienceCueIds(current => current.includes(cue.id) ? current : [...current, cue.id]);
        } else {
            playbackByChannelRef.current[cue.channel] = handle;
        }
        setPlayingByChannel(current => ({ ...current, [cue.channel]: cue.id }));

        if (syncToPlayers) {
            yjsStore.sendAudioCommand({
                action: 'play',
                assetId: cue.channel === 'ambience' ? cue.id : cue.assetId,
                assetPath: cue.assetPath,
                assetName: cue.assetName,
                channel: cue.channel,
                volume: cue.volume,
                duration: null,
                loop: cue.loop,
                fadeMs: cue.fadeMs,
                startedAt,
            });
        }

        void handle.playPromise.catch(clearCuePlayback);
    }, [audioAssetsById, publishMusicError, stopChannel, syncToPlayers]);

    const toggleCue = useCallback((cue: AudioCue) => {
        if (cue.channel === 'ambience' && playingAmbienceCueIds.includes(cue.id)) {
            stopAmbienceCue(cue);
            return;
        }
        if (playingByChannel[cue.channel] === cue.id) {
            stopChannel(cue.channel);
            return;
        }
        playCue(cue);
    }, [playCue, playingAmbienceCueIds, playingByChannel, stopAmbienceCue, stopChannel]);

    if (!isHost) {
        return (
            <div className={audioShellClass}>
                {!isCompactChrome && (
                    <div className="border-b border-[var(--vibe-border-subtle)] p-4">
                        <div className="flex items-center gap-3">
                            <div className={audioIconClass}>
                                <Headphones size={18} />
                            </div>
                            <div className="min-w-0">
                                <div className="text-sm font-black uppercase tracking-wider text-[var(--vibe-text-primary)]">Звук сессии</div>
                                <div className="truncate text-[11px] text-[var(--vibe-text-faint)]">Локальные настройки игрока</div>
                            </div>
                        </div>
                    </div>
                )}
                <div className="space-y-4 p-4">
                    <label className="hidden">
                        <span className="text-xs font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">Принимать звук</span>
                        <input
                            type="checkbox"
                            checked={sessionAudioEnabled}
                            onChange={(event) => setSessionAudioEnabled(event.target.checked)}
                            className="h-4 w-4 accent-[var(--vibe-accent)]"
                        />
                    </label>
                    <div className={`${audioPanelClass} space-y-3`}>
                        {CHANNELS.map(channel => (
                            <label key={channel.id} className="grid grid-cols-[82px_1fr_34px] items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                <span>{channel.label}</span>
                                <input
                                    type="range"
                                    min={0}
                                    max={1}
                                    step={0.01}
                                    value={channelVolumes[channel.id]}
                                    onChange={(event) => setChannelVolume(channel.id, Number(event.target.value))}
                                    className="w-full accent-[var(--vibe-accent)]"
                                />
                                <span className="text-right font-mono text-[var(--vibe-text-muted)]">{Math.round(channelVolumes[channel.id] * 100)}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            className={audioShellClass}
            onDragOver={(event) => {
                if (Array.from(event.dataTransfer.items || []).some(item => item.kind === 'file')) event.preventDefault();
            }}
            onDrop={handleAudioDrop}
        >
            <div className="border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)] p-3">
                {!isCompactChrome && (
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                            <div className={audioIconClass}>
                                <SlidersHorizontal size={17} />
                            </div>
                            <div className="min-w-0">
                                <div className="truncate text-sm font-black uppercase tracking-wider text-[var(--vibe-text-primary)]">Пульт звука</div>
                                <div className="truncate text-[10px] font-semibold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                    {deckState.cues.length} кнопок / {assets.length} аудио
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => void loadAssets()}
                                className={`${audioButtonClass} h-8 w-8`}
                                title="Обновить аудио ассеты"
                            >
                                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                            <button
                                type="button"
                                onClick={stopAll}
                                className={`${audioButtonClass} ${audioDangerButtonClass} h-8 w-8`}
                                title="Остановить все каналы"
                            >
                                <VolumeX size={14} />
                            </button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-4 gap-1">
                    {CHANNELS.map(channel => {
                        const isActive = activeChannel === channel.id;
                        const playingCueId = playingByChannel[channel.id];
                        const playingCue = playingCueId ? deckState.cues.find(cue => cue.id === playingCueId) : null;
                        const ambienceCount = channel.id === 'ambience' ? playingAmbienceCueIds.length : 0;
                        return (
                            <button
                                key={channel.id}
                                type="button"
                                onClick={() => setActiveChannel(channel.id)}
                                className={`min-w-0 rounded-[var(--vibe-radius-sm)] border px-2 py-2 text-left transition-colors ${
                                    isActive
                                        ? audioActiveClass
                                        : audioIdleClass
                                }`}
                            >
                                <span className="block text-[9px] font-black uppercase tracking-wider">{channel.shortLabel}</span>
                                <span className="mt-0.5 block truncate text-[10px] font-semibold">
                                    {ambienceCount > 1 ? `${ambienceCount} loops` : playingCue ? playingCue.label ?? playingCue.assetName : channel.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="grid border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3">
                <div className="flex items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 py-2 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">
                        <Radio size={13} className={syncToPlayers ? 'text-[var(--vibe-success)]' : 'text-[var(--vibe-text-faint)]'} />
                        Игрокам
                        <input
                            type="checkbox"
                            checked={syncToPlayers}
                            onChange={(event) => setSyncToPlayers(event.target.checked)}
                            className="h-3.5 w-3.5 accent-[var(--vibe-success)]"
                        />
                    </label>
                    {isCompactChrome && (
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => void loadAssets()}
                                className={`${audioButtonClass} h-8 w-8`}
                                title="Обновить аудио ассеты"
                            >
                                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                            </button>
                            <button
                                type="button"
                                onClick={stopAll}
                                className={`${audioButtonClass} ${audioDangerButtonClass} h-8 w-8`}
                                title="Остановить все каналы"
                            >
                                <VolumeX size={14} />
                            </button>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5" title="Fade in/out для запуска и остановки звука">
                        <span className="text-[9px] font-black uppercase tracking-wider text-[var(--vibe-text-faint)]">Fade</span>
                        {[0, 1000, 3000].map(value => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setFadeMs(value)}
                                className={`rounded-[var(--vibe-radius-sm)] px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${
                                    fadeMs === value ? 'bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]' : 'text-[var(--vibe-text-faint)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                }`}
                            >
                                {value === 0 ? '0s' : `${value / 1000}s`}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                    {CHANNELS.map(channel => (
                        <label key={channel.id} className="grid grid-cols-[62px_1fr_28px] items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                            <span>{channel.shortLabel}</span>
                            <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.01}
                                value={channelVolumes[channel.id]}
                                onChange={(event) => setChannelVolume(channel.id, Number(event.target.value))}
                                className="w-full accent-[var(--vibe-success)]"
                            />
                            <span className="text-right font-mono text-[var(--vibe-text-muted)]">{Math.round(channelVolumes[channel.id] * 100)}</span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
                {error && (
                    <div className="m-3 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] p-2 text-xs text-[var(--vibe-danger)]">
                        {error}
                    </div>
                )}

                <div className="border-b border-[var(--vibe-border-subtle)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                        <div className={audioTitleClass}>
                            <Music size={13} />
                            Кнопки / {getChannelLabel(activeChannel)}
                        </div>
                        {(activeChannel === 'ambience' ? playingAmbienceCueIds.length > 0 : playingByChannel[activeChannel]) && (
                            <button
                                type="button"
                                onClick={() => stopChannel(activeChannel)}
                                className={`rounded-[var(--vibe-radius-sm)] border px-2 py-1 text-[9px] font-black uppercase tracking-wider transition-colors ${audioDangerButtonClass}`}
                            >
                                Стоп
                            </button>
                        )}
                    </div>

                    {cuesForActiveChannel.length === 0 ? (
                        <div className="rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-4 text-center text-xs italic text-[var(--vibe-text-faint)]">
                            Нет кнопок на этом канале
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cuesForActiveChannel.map(cue => {
                                const isPlaying = cue.channel === 'ambience'
                                    ? playingAmbienceCueIds.includes(cue.id)
                                    : playingByChannel[cue.channel] === cue.id;
                                const isMissing = !audioAssetsById.has(cue.assetId);
                                return (
                                    <div
                                        key={cue.id}
                                        className={`rounded-[var(--vibe-radius-md)] border p-2 shadow-inner transition-colors ${
                                            isPlaying
                                                ? 'border-[color-mix(in_srgb,var(--vibe-success)_42%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_14%,transparent)]'
                                                : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)]'
                                        } ${isMissing ? 'opacity-45' : ''}`}
                                    >
                                        <div className="min-h-[34px]">
                                            <div className="truncate text-xs font-black text-[var(--vibe-text-primary)]" title={cue.assetName}>
                                                {cue.label ?? cue.assetName}
                                            </div>
                                            <div className="mt-0.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                <span>{getCueModeLabel(cue.mode)}</span>
                                                {cue.loop && <span>Loop</span>}
                                            </div>
                                        </div>
                                        <div className="mt-2 flex items-center justify-between gap-1">
                                            <button
                                                type="button"
                                                onClick={() => toggleCue(cue)}
                                                disabled={isMissing}
                                                className={`flex h-8 flex-1 items-center justify-center rounded-lg border text-[10px] font-black uppercase tracking-wider transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                                                    isPlaying
                                                        ? 'border-[color-mix(in_srgb,var(--vibe-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_18%,transparent)] text-[var(--vibe-success)]'
                                                        : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                                }`}
                                            >
                                                {isPlaying ? <Square size={13} /> : <Play size={13} />}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeCue(cue.id)}
                                                className={`flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border transition-colors ${audioDangerButtonClass}`}
                                                title="Удалить cue"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="p-3 pb-8">
                    <div className="mb-2 flex items-center justify-between">
                        <div className={audioTitleClass}>
                            <Volume2 size={13} />
                            Аудио
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="hidden items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] sm:inline-flex">
                                <Upload size={11} />
                                Drop
                            </span>
                            <span className="font-mono text-[10px] text-[var(--vibe-text-faint)]">{visibleAssets.length}</span>
                        </div>
                    </div>
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Поиск аудио..."
                        className={`${glass.input} mb-2 h-9 w-full px-3 text-xs`}
                    />

                    {visibleAssets.length === 0 ? (
                        <div className="rounded-[var(--vibe-radius-md)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-4 text-center text-xs italic text-[var(--vibe-text-faint)]">
                            {isLoading ? 'Сканирую assets...' : 'Аудио не найдено'}
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {visibleAssets.slice(0, 80).map(asset => (
                                <div key={asset.id} className="flex items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="truncate text-xs font-bold text-[var(--vibe-text-muted)]" title={asset.path}>{asset.name}</div>
                                        <div className="truncate text-[9px] text-[var(--vibe-text-faint)]">{asset.path}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => addCueFromAsset(asset)}
                                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-success)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_12%,transparent)] text-[var(--vibe-success)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-success)_20%,transparent)]"
                                        title={`Добавить в ${getChannelLabel(activeChannel)}`}
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
