import { useCallback, useEffect, useState } from 'react';
import { primeAudioOutput } from '../services/audioPlayback';

const AUDIO_SESSION_ENABLED_KEY = 'vibe_audio_session_enabled';
const AUDIO_SESSION_ENABLED_EVENT = 'vibe-audio-session-enabled-change';

export function getAudioSessionEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(AUDIO_SESSION_ENABLED_KEY) === 'true';
}

export function setAudioSessionEnabled(enabled: boolean): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(AUDIO_SESSION_ENABLED_KEY, enabled ? 'true' : 'false');
    window.dispatchEvent(new CustomEvent(AUDIO_SESSION_ENABLED_EVENT, { detail: enabled }));
}

export function useAudioSessionEnabled(): [boolean, (enabled: boolean) => void] {
    const [enabled, setEnabledState] = useState(() => getAudioSessionEnabled());

    useEffect(() => {
        const handleChange = (event: Event) => {
            const customEvent = event as CustomEvent<boolean>;
            setEnabledState(typeof customEvent.detail === 'boolean' ? customEvent.detail : getAudioSessionEnabled());
        };

        window.addEventListener(AUDIO_SESSION_ENABLED_EVENT, handleChange);
        window.addEventListener('storage', handleChange);
        return () => {
            window.removeEventListener(AUDIO_SESSION_ENABLED_EVENT, handleChange);
            window.removeEventListener('storage', handleChange);
        };
    }, []);

    const setEnabled = useCallback((nextEnabled: boolean) => {
        setAudioSessionEnabled(nextEnabled);
        setEnabledState(nextEnabled);
        if (nextEnabled) void primeAudioOutput();
    }, []);

    return [enabled, setEnabled];
}
