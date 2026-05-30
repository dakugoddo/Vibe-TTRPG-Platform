import { useCallback, useEffect, useRef } from 'react';
import { getAssetUrl, getIsHost } from '../../services/fileApi';
import { clampVolume, normalizeAudioFadeMs, shouldUseBufferedPlayback, startBufferedSfxPlayback, startMediaPlayback, type AudioPlaybackHandle } from '../../services/audioPlayback';
import { yjsStore } from '../../store/yjsStore';
import type { AudioChannel, AudioSessionCommand } from '../../types';
import { useAudioSessionEnabled } from '../../hooks/useAudioSessionEnabled';

const MAX_SFX_COMMAND_AGE_MS = 30_000;
const MAX_TRACK_COMMAND_AGE_MS = 6 * 60 * 60 * 1000;

export function AudioSessionBridge() {
    const [enabled] = useAudioSessionEnabled();
    const enabledRef = useRef(enabled);
    const audioByChannelRef = useRef<Partial<Record<AudioChannel, AudioPlaybackHandle>>>({});
    const ambienceAudioByAssetRef = useRef<Record<string, AudioPlaybackHandle>>({});
    const lastCommandIdRef = useRef<string | null>(null);

    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);

    const stopAmbienceAsset = useCallback((assetKey: string, fadeOutMs?: number) => {
        ambienceAudioByAssetRef.current[assetKey]?.stop(fadeOutMs);
        delete ambienceAudioByAssetRef.current[assetKey];
        if (Object.keys(ambienceAudioByAssetRef.current).length === 0) {
            delete audioByChannelRef.current.ambience;
        }
    }, []);

    const stopChannel = useCallback((channel: AudioChannel, fadeOutMs?: number) => {
        if (channel === 'ambience') {
            Object.values(ambienceAudioByAssetRef.current).forEach(handle => handle.stop(fadeOutMs));
            ambienceAudioByAssetRef.current = {};
            delete audioByChannelRef.current.ambience;
            return;
        }
        audioByChannelRef.current[channel]?.stop(fadeOutMs);
        delete audioByChannelRef.current[channel];
    }, []);

    const stopAllAudio = useCallback((fadeOutMs?: number) => {
        Object.keys(audioByChannelRef.current).forEach((channel) => {
            stopChannel(channel as AudioChannel, fadeOutMs);
        });
        audioByChannelRef.current = {};
    }, [stopChannel]);

    const setChannelPlayback = useCallback((channel: AudioChannel, playback: AudioPlaybackHandle | null) => {
        if (playback) {
            audioByChannelRef.current[channel] = playback;
            return;
        }
        delete audioByChannelRef.current[channel];
    }, []);

    const handleCommand = useCallback((command: AudioSessionCommand) => {
        if (getIsHost()) return;
        if (command.senderId && command.senderId === yjsStore.localPlayerId) return;
        if (lastCommandIdRef.current === command.id) return;

        if (command.action === 'stop') {
            lastCommandIdRef.current = command.id;
            const fadeMs = normalizeAudioFadeMs(command.fadeMs);
            if (command.channel === 'ambience' && command.assetId && !command.assetId.startsWith('channel:')) {
                stopAmbienceAsset(command.assetId, fadeMs);
            } else if (command.channel) {
                stopChannel(command.channel, fadeMs);
            } else {
                stopAllAudio(fadeMs);
            }
            return;
        }

        if (!enabledRef.current) return;

        const channel = command.channel ?? 'sfx';
        const isTrackChannel = channel === 'music' || channel === 'ambience';
        const startedAt = command.startedAt ?? command.issuedAt;
        const ageMs = Date.now() - startedAt;
        if (ageMs > (isTrackChannel ? MAX_TRACK_COMMAND_AGE_MS : MAX_SFX_COMMAND_AGE_MS)) return;
        if (!command.loop && command.duration && ageMs / 1000 > command.duration + 2) return;

        lastCommandIdRef.current = command.id;
        const ambienceAssetKey = command.assetId || command.assetPath;
        if (channel === 'ambience') {
            stopAmbienceAsset(ambienceAssetKey);
        } else {
            stopChannel(channel);
        }
        let playback: AudioPlaybackHandle | null = null;
        const fadeMs = normalizeAudioFadeMs(command.fadeMs);
        const playbackOptions = {
            url: getAssetUrl(command.assetPath),
            volume: clampVolume(command.volume),
            channel,
            offsetSeconds: ageMs > 250 ? ageMs / 1000 : 0,
            loop: Boolean(command.loop),
            fadeInMs: fadeMs > 0 && ageMs <= fadeMs ? fadeMs : 0,
            onEnded: () => {
                if (!playback) return;
                if (channel === 'ambience') {
                    if (ambienceAudioByAssetRef.current[ambienceAssetKey] === playback) stopAmbienceAsset(ambienceAssetKey);
                    return;
                }
                if (audioByChannelRef.current[channel] === playback) setChannelPlayback(channel, null);
            },
            onError: () => {
                if (!playback) return;
                if (channel === 'ambience') {
                    if (ambienceAudioByAssetRef.current[ambienceAssetKey] === playback) stopAmbienceAsset(ambienceAssetKey);
                    return;
                }
                if (audioByChannelRef.current[channel] === playback) setChannelPlayback(channel, null);
            },
        };
        playback = !isTrackChannel && (command.duration == null || shouldUseBufferedPlayback(command.duration, undefined))
            ? startBufferedSfxPlayback(playbackOptions)
            : startMediaPlayback(playbackOptions);
        if (channel === 'ambience') {
            ambienceAudioByAssetRef.current[ambienceAssetKey] = playback;
            audioByChannelRef.current.ambience = playback;
        } else {
            setChannelPlayback(channel, playback);
        }

        void playback.playPromise.catch(() => {
            if (channel === 'ambience') {
                if (ambienceAudioByAssetRef.current[ambienceAssetKey] === playback) stopAmbienceAsset(ambienceAssetKey);
                return;
            }
            if (audioByChannelRef.current[channel] === playback) setChannelPlayback(channel, null);
        });
    }, [setChannelPlayback, stopAllAudio, stopAmbienceAsset, stopChannel]);

    useEffect(() => {
        const unsubscribe = yjsStore.observeAudioCommands(handleCommand);
        const latestCommand = yjsStore.getLatestAudioCommand();
        if (latestCommand) handleCommand(latestCommand);

        return () => {
            unsubscribe();
            stopAllAudio();
        };
    }, [handleCommand, stopAllAudio]);

    useEffect(() => {
        if (!enabled) return;
        const latestCommand = yjsStore.getLatestAudioCommand();
        if (latestCommand) handleCommand(latestCommand);
    }, [enabled, handleCommand]);

    useEffect(() => {
        if (enabled) return;
        stopAllAudio();
    }, [enabled, stopAllAudio]);

    return null;
}
