import type { AudioChannel } from '../types';

export interface AudioPlaybackHandle {
    playPromise: Promise<void>;
    setVolume: (volume: number) => void;
    stop: (fadeOutMs?: number) => void;
    pause?: () => void;
    resume?: () => Promise<void>;
}

export interface MediaPlaybackHandle extends AudioPlaybackHandle {
    element: HTMLAudioElement;
}

interface StartMediaPlaybackOptions {
    url: string;
    volume: number;
    channel?: AudioChannel;
    offsetSeconds?: number;
    loop?: boolean;
    fadeInMs?: number;
    onEnded?: () => void;
    onError?: (error: unknown) => void;
}

interface StartBufferedPlaybackOptions extends StartMediaPlaybackOptions {
    fallbackToMedia?: boolean;
}

const MAX_BUFFER_CACHE_ITEMS = 24;
export const MAX_AUDIO_FADE_MS = 10_000;
const AUDIO_CHANNEL_VOLUMES_KEY = 'vibe_audio_channel_volumes';
export const AUDIO_CHANNEL_VOLUME_EVENT = 'vibe-audio-channel-volume-change';
export const AUDIO_CHANNELS: AudioChannel[] = ['music', 'ambience', 'sfx', 'voice'];
const DEFAULT_CHANNEL_VOLUMES: Record<AudioChannel, number> = {
    music: 1,
    ambience: 1,
    sfx: 1,
    voice: 1,
};

let sharedAudioContext: AudioContext | null = null;
const audioBufferCache = new Map<string, Promise<AudioBuffer>>();
const channelVolumes: Record<AudioChannel, number> = { ...DEFAULT_CHANNEL_VOLUMES };
let channelVolumesInitialized = false;

export function clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 0.75;
    return Math.max(0, Math.min(1, value));
}

export function normalizeAudioFadeMs(value: number | null | undefined): number {
    if (value == null || !Number.isFinite(value)) return 0;
    return Math.round(Math.max(0, Math.min(MAX_AUDIO_FADE_MS, value)));
}

export function calculateLinearFadeVolume(startVolume: number, targetVolume: number, elapsedMs: number, fadeMs: number): number {
    const normalizedFadeMs = normalizeAudioFadeMs(fadeMs);
    if (normalizedFadeMs <= 0) return clampVolume(targetVolume);
    const progress = Math.max(0, Math.min(1, elapsedMs / normalizedFadeMs));
    return clampVolume(startVolume + (targetVolume - startVolume) * progress);
}

export function normalizeAudioChannel(channel: AudioChannel | undefined): AudioChannel {
    return channel ?? 'sfx';
}

function isAudioChannel(value: string): value is AudioChannel {
    return (AUDIO_CHANNELS as string[]).includes(value);
}

function ensureChannelVolumesInitialized(): void {
    if (channelVolumesInitialized) return;
    channelVolumesInitialized = true;
    if (typeof window === 'undefined') return;

    try {
        const parsed = JSON.parse(window.localStorage.getItem(AUDIO_CHANNEL_VOLUMES_KEY) || '{}') as Record<string, unknown>;
        for (const [channel, volume] of Object.entries(parsed)) {
            if (isAudioChannel(channel) && typeof volume === 'number') {
                channelVolumes[channel] = clampVolume(volume);
            }
        }
    } catch {
        // Ignore malformed local settings and keep defaults.
    }
}

function persistChannelVolumes(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDIO_CHANNEL_VOLUMES_KEY, JSON.stringify(channelVolumes));
    window.dispatchEvent(new CustomEvent(AUDIO_CHANNEL_VOLUME_EVENT, { detail: getAudioChannelVolumesSnapshot() }));
}

export function getAudioChannelVolumesSnapshot(): Record<AudioChannel, number> {
    ensureChannelVolumesInitialized();
    return { ...channelVolumes };
}

export function getAudioChannelVolume(channel: AudioChannel | undefined): number {
    ensureChannelVolumesInitialized();
    return channelVolumes[normalizeAudioChannel(channel)];
}

export function setAudioChannelVolume(channel: AudioChannel, volume: number): void {
    ensureChannelVolumesInitialized();
    channelVolumes[channel] = clampVolume(volume);
    persistChannelVolumes();
}

export function getEffectiveVolume(volume: number, channel?: AudioChannel): number {
    return clampVolume(clampVolume(volume) * getAudioChannelVolume(channel));
}

function getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextCtor = window.AudioContext
        ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;

    sharedAudioContext ??= new AudioContextCtor();
    return sharedAudioContext;
}

export function getAudioBufferCacheSize(): number {
    return audioBufferCache.size;
}

export function clearAudioBufferCache(): void {
    audioBufferCache.clear();
}

export function shouldUseBufferedPlayback(durationSeconds: number | null | undefined, sizeBytes?: number): boolean {
    if (durationSeconds != null && durationSeconds > 0) return durationSeconds <= 12;
    if (typeof sizeBytes === 'number' && sizeBytes > 0) return sizeBytes <= 1_500_000;
    return false;
}

export async function primeAudioOutput(): Promise<void> {
    const audioContext = getAudioContext();
    if (!audioContext) return;

    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }
}

export async function preloadAudioBuffer(url: string): Promise<AudioBuffer | null> {
    const audioContext = getAudioContext();
    if (!audioContext || typeof fetch === 'undefined') return null;

    if (!audioBufferCache.has(url)) {
        if (audioBufferCache.size >= MAX_BUFFER_CACHE_ITEMS) {
            const oldestKey = audioBufferCache.keys().next().value as string | undefined;
            if (oldestKey) audioBufferCache.delete(oldestKey);
        }

        const bufferPromise = fetch(url)
            .then((response) => {
                if (!response.ok) throw new Error(`Failed to fetch audio buffer: ${response.status}`);
                return response.arrayBuffer();
            })
            .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer));

        audioBufferCache.set(url, bufferPromise);
    }

    try {
        return await audioBufferCache.get(url) ?? null;
    } catch (error) {
        audioBufferCache.delete(url);
        throw error;
    }
}

export function loadAudioDuration(url: string): Promise<number | null> {
    return new Promise((resolve) => {
        const audio = new Audio();

        function cleanup() {
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('error', handleError);
            audio.removeAttribute('src');
            audio.load();
        }

        function handleLoadedMetadata() {
            const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : null;
            cleanup();
            resolve(duration);
        }

        function handleError() {
            cleanup();
            resolve(null);
        }

        audio.preload = 'metadata';
        audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
        audio.addEventListener('error', handleError, { once: true });
        audio.src = url;
        audio.load();
    });
}

export function startMediaPlayback(options: StartMediaPlaybackOptions): MediaPlaybackHandle {
    const audio = new Audio(options.url);
    const offsetSeconds = Math.max(0, options.offsetSeconds ?? 0);
    const channel = normalizeAudioChannel(options.channel);
    const fadeInMs = normalizeAudioFadeMs(options.fadeInMs);
    let targetVolume = getEffectiveVolume(options.volume, channel);
    let baseVolume = clampVolume(options.volume);
    let fadeTimer: number | null = null;
    let disposed = false;

    function clearFadeTimer() {
        if (fadeTimer == null || typeof window === 'undefined') return;
        window.clearInterval(fadeTimer);
        fadeTimer = null;
    }

    function cleanupListeners() {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
    }

    function disposeMediaElement() {
        if (disposed) return;
        disposed = true;
        cleanupListeners();
        clearFadeTimer();
        unsubscribeChannelVolume();
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
    }

    function rampMediaVolume(startVolume: number, getTargetVolume: () => number, fadeMs: number, onComplete?: () => void) {
        const normalizedFadeMs = normalizeAudioFadeMs(fadeMs);
        clearFadeTimer();
        if (normalizedFadeMs <= 0 || typeof window === 'undefined') {
            audio.volume = clampVolume(getTargetVolume());
            onComplete?.();
            return;
        }

        const startedAt = Date.now();
        audio.volume = clampVolume(startVolume);
        fadeTimer = window.setInterval(() => {
            const elapsedMs = Date.now() - startedAt;
            audio.volume = calculateLinearFadeVolume(startVolume, getTargetVolume(), elapsedMs, normalizedFadeMs);
            if (elapsedMs >= normalizedFadeMs) {
                clearFadeTimer();
                audio.volume = clampVolume(getTargetVolume());
                onComplete?.();
            }
        }, 50);
    }

    function handleLoadedMetadata() {
        if (offsetSeconds <= 0) return;
        if (!Number.isFinite(audio.duration) || audio.duration <= offsetSeconds) return;
        audio.currentTime = offsetSeconds;
    }

    function handleEnded() {
        cleanupListeners();
        clearFadeTimer();
        unsubscribeChannelVolume();
        disposed = true;
        options.onEnded?.();
    }

    function handleError() {
        cleanupListeners();
        clearFadeTimer();
        unsubscribeChannelVolume();
        disposed = true;
        options.onError?.(new Error(`Failed to play audio: ${options.url}`));
    }

    function applyEffectiveVolume() {
        targetVolume = getEffectiveVolume(baseVolume, channel);
        if (fadeTimer == null) audio.volume = targetVolume;
    }

    const unsubscribeChannelVolume = (() => {
        if (typeof window === 'undefined') return () => undefined;
        const handleChannelVolumeChange = () => {
            if (!disposed) applyEffectiveVolume();
        };
        window.addEventListener(AUDIO_CHANNEL_VOLUME_EVENT, handleChannelVolumeChange);
        return () => window.removeEventListener(AUDIO_CHANNEL_VOLUME_EVENT, handleChannelVolumeChange);
    })();

    audio.volume = fadeInMs > 0 ? 0 : targetVolume;
    audio.loop = Boolean(options.loop);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    audio.addEventListener('ended', handleEnded, { once: true });
    audio.addEventListener('error', handleError, { once: true });

    const handle: MediaPlaybackHandle = {
        element: audio,
        playPromise: audio.play().then(() => {
            if (fadeInMs > 0 && !disposed) {
                rampMediaVolume(0, () => targetVolume, fadeInMs);
            }
        }).catch((error) => {
            disposeMediaElement();
            options.onError?.(error);
            throw error;
        }),
        setVolume: (volume: number) => {
            baseVolume = clampVolume(volume);
            applyEffectiveVolume();
        },
        stop: (fadeOutMs?: number) => {
            const normalizedFadeOutMs = normalizeAudioFadeMs(fadeOutMs);
            if (normalizedFadeOutMs <= 0) {
                disposeMediaElement();
                return;
            }
            cleanupListeners();
            rampMediaVolume(audio.volume, () => 0, normalizedFadeOutMs, disposeMediaElement);
        },
        pause: () => {
            if (!disposed) audio.pause();
        },
        resume: async () => {
            if (disposed) return;
            await audio.play();
        },
    };

    return handle;
}

export function startBufferedSfxPlayback(options: StartBufferedPlaybackOptions): AudioPlaybackHandle {
    const audioContext = getAudioContext();
    if (!audioContext || typeof fetch === 'undefined') {
        return startMediaPlayback(options);
    }
    const activeAudioContext = audioContext;

    let source: AudioBufferSourceNode | null = null;
    let gainNode: GainNode | null = null;
    let fallbackHandle: AudioPlaybackHandle | null = null;
    let stopTimer: number | null = null;
    let stopped = false;
    const channel = normalizeAudioChannel(options.channel);
    let baseVolume = clampVolume(options.volume);
    let currentVolume = getEffectiveVolume(baseVolume, channel);
    const fadeInMs = normalizeAudioFadeMs(options.fadeInMs);

    function clearStopTimer() {
        if (stopTimer == null || typeof window === 'undefined') return;
        window.clearTimeout(stopTimer);
        stopTimer = null;
    }

    function cleanupNodes() {
        clearStopTimer();
        source?.disconnect();
        gainNode?.disconnect();
        source = null;
        gainNode = null;
        unsubscribeChannelVolume();
    }

    function rampGainTo(gain: AudioParam, volume: number, fadeMs?: number) {
        const now = activeAudioContext.currentTime;
        const normalizedFadeMs = normalizeAudioFadeMs(fadeMs);
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(gain.value, now);
        if (normalizedFadeMs > 0) {
            gain.linearRampToValueAtTime(clampVolume(volume), now + normalizedFadeMs / 1000);
        } else {
            gain.setValueAtTime(clampVolume(volume), now);
        }
    }

    function applyEffectiveVolume() {
        currentVolume = getEffectiveVolume(baseVolume, channel);
        fallbackHandle?.setVolume(baseVolume);
        if (gainNode) rampGainTo(gainNode.gain, currentVolume);
    }

    const unsubscribeChannelVolume = (() => {
        if (typeof window === 'undefined') return () => undefined;
        const handleChannelVolumeChange = () => {
            if (!stopped) applyEffectiveVolume();
        };
        window.addEventListener(AUDIO_CHANNEL_VOLUME_EVENT, handleChannelVolumeChange);
        return () => window.removeEventListener(AUDIO_CHANNEL_VOLUME_EVENT, handleChannelVolumeChange);
    })();

    const playPromise = (async () => {
        try {
            if (activeAudioContext.state === 'suspended') await activeAudioContext.resume();
            const buffer = await preloadAudioBuffer(options.url);
            if (!buffer || stopped) return;

            const offsetSeconds = Math.max(0, options.offsetSeconds ?? 0);
            source = activeAudioContext.createBufferSource();
            gainNode = activeAudioContext.createGain();
            source.buffer = buffer;
            source.loop = Boolean(options.loop);
            gainNode.gain.value = fadeInMs > 0 ? 0 : currentVolume;
            source.connect(gainNode);
            gainNode.connect(activeAudioContext.destination);
            source.addEventListener('ended', () => {
                cleanupNodes();
                if (!stopped) options.onEnded?.();
            }, { once: true });
            source.start(0, offsetSeconds < buffer.duration ? offsetSeconds : 0);
            if (fadeInMs > 0) {
                rampGainTo(gainNode.gain, currentVolume, fadeInMs);
            }
        } catch (error) {
            if (stopped) return;
            if (options.fallbackToMedia !== false) {
                fallbackHandle = startMediaPlayback(options);
                fallbackHandle.playPromise.catch(() => undefined);
                return fallbackHandle.playPromise;
            }
            options.onError?.(error);
            throw error;
        }
    })();

    return {
        playPromise,
        setVolume: (volume: number) => {
            baseVolume = clampVolume(volume);
            applyEffectiveVolume();
        },
        stop: (fadeOutMs?: number) => {
            stopped = true;
            unsubscribeChannelVolume();
            if (fallbackHandle) {
                fallbackHandle.stop(fadeOutMs);
                fallbackHandle = null;
                return;
            }

            const normalizedFadeOutMs = normalizeAudioFadeMs(fadeOutMs);
            if (normalizedFadeOutMs > 0 && source && gainNode && typeof window !== 'undefined') {
                const sourceToStop = source;
                rampGainTo(gainNode.gain, 0, normalizedFadeOutMs);
                clearStopTimer();
                stopTimer = window.setTimeout(() => {
                    try {
                        sourceToStop.stop();
                    } catch {
                        // Source may have ended naturally while fading.
                    }
                    cleanupNodes();
                }, normalizedFadeOutMs);
                return;
            }

            try {
                source?.stop();
            } catch {
                // Source may not have started yet; stopping is still a no-op for callers.
            }
            cleanupNodes();
        },
    };
}
