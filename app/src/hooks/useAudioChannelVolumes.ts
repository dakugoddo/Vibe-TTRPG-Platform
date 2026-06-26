import { useCallback, useEffect, useState } from 'react';
import {
    AUDIO_CHANNEL_VOLUME_EVENT,
    getAudioChannelVolumesSnapshot,
    setAudioChannelVolume,
} from '../services/audioPlayback';
import type { AudioChannel } from '../types';

export function useAudioChannelVolumes(): [Record<AudioChannel, number>, (channel: AudioChannel, volume: number) => void] {
    const [volumes, setVolumes] = useState(() => getAudioChannelVolumesSnapshot());

    useEffect(() => {
        const handleChange = () => setVolumes(getAudioChannelVolumesSnapshot());
        window.addEventListener(AUDIO_CHANNEL_VOLUME_EVENT, handleChange);
        window.addEventListener('storage', handleChange);
        return () => {
            window.removeEventListener(AUDIO_CHANNEL_VOLUME_EVENT, handleChange);
            window.removeEventListener('storage', handleChange);
        };
    }, []);

    const setVolume = useCallback((channel: AudioChannel, volume: number) => {
        setAudioChannelVolume(channel, volume);
        setVolumes(getAudioChannelVolumesSnapshot());
    }, []);

    return [volumes, setVolume];
}
