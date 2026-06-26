import { strict as assert } from 'node:assert';
import {
    calculateLinearFadeVolume,
    clampVolume,
    clearAudioBufferCache,
    getAudioBufferCacheSize,
    getAudioChannelVolume,
    getAudioChannelVolumesSnapshot,
    getEffectiveVolume,
    MAX_AUDIO_FADE_MS,
    normalizeAudioFadeMs,
    normalizeAudioChannel,
    setAudioChannelVolume,
    shouldUseBufferedPlayback,
    startMediaPlayback,
} from './audioPlayback';

function test(name: string, fn: () => void) {
    try {
        fn();
        console.log(`ok - ${name}`);
    } catch (error) {
        console.error(`not ok - ${name}`);
        throw error;
    }
}

test('clampVolume keeps valid values', () => {
    assert.equal(clampVolume(0), 0);
    assert.equal(clampVolume(0.5), 0.5);
    assert.equal(clampVolume(1), 1);
});

test('clampVolume clamps invalid values', () => {
    assert.equal(clampVolume(-1), 0);
    assert.equal(clampVolume(2), 1);
    assert.equal(clampVolume(Number.NaN), 0.75);
});

test('normalizeAudioFadeMs clamps fade durations', () => {
    assert.equal(normalizeAudioFadeMs(undefined), 0);
    assert.equal(normalizeAudioFadeMs(null), 0);
    assert.equal(normalizeAudioFadeMs(Number.NaN), 0);
    assert.equal(normalizeAudioFadeMs(-100), 0);
    assert.equal(normalizeAudioFadeMs(1250.4), 1250);
    assert.equal(normalizeAudioFadeMs(MAX_AUDIO_FADE_MS + 1), MAX_AUDIO_FADE_MS);
});

test('calculateLinearFadeVolume interpolates between volumes', () => {
    assert.equal(calculateLinearFadeVolume(0, 1, 0, 1000), 0);
    assert.equal(calculateLinearFadeVolume(0, 1, 500, 1000), 0.5);
    assert.equal(calculateLinearFadeVolume(0, 1, 1500, 1000), 1);
    assert.equal(calculateLinearFadeVolume(1, 0, 250, 1000), 0.75);
    assert.equal(calculateLinearFadeVolume(0.25, 0.75, 250, 0), 0.75);
});

test('shouldUseBufferedPlayback prefers short or small SFX', () => {
    assert.equal(shouldUseBufferedPlayback(4, 8_000_000), true);
    assert.equal(shouldUseBufferedPlayback(60, 50_000), false);
    assert.equal(shouldUseBufferedPlayback(null, 250_000), true);
    assert.equal(shouldUseBufferedPlayback(undefined, 2_000_000), false);
});

test('audio buffer cache can be cleared without browser APIs', () => {
    clearAudioBufferCache();
    assert.equal(getAudioBufferCacheSize(), 0);
});

test('audio channel volume defaults and clamps', () => {
    assert.equal(normalizeAudioChannel(undefined), 'sfx');
    setAudioChannelVolume('sfx', 0.5);
    assert.equal(getAudioChannelVolume('sfx'), 0.5);
    assert.equal(getEffectiveVolume(0.5, 'sfx'), 0.25);
    assert.equal(getAudioChannelVolumesSnapshot().sfx, 0.5);

    setAudioChannelVolume('sfx', 2);
    assert.equal(getAudioChannelVolume('sfx'), 1);
    setAudioChannelVolume('sfx', 1);
});

test('media playback handles react to channel volume changes', () => {
    const previousWindow = (globalThis as { window?: unknown }).window;
    const previousAudio = (globalThis as { Audio?: unknown }).Audio;
    const target = new EventTarget();
    const localStorage = {
        getItem: () => null,
        setItem: () => undefined,
    };

    class MockAudio {
        src = '';
        volume = 1;
        loop = false;
        duration = 120;
        currentTime = 0;
        addEventListener = () => undefined;
        removeEventListener = () => undefined;
        play = () => Promise.resolve();
        pause = () => undefined;
        removeAttribute = () => undefined;
        load = () => undefined;
    }

    (globalThis as { window?: unknown }).window = {
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
        dispatchEvent: target.dispatchEvent.bind(target),
        localStorage,
        setInterval,
        clearInterval,
        setTimeout,
        clearTimeout,
    };
    (globalThis as { Audio?: unknown }).Audio = MockAudio;

    try {
        setAudioChannelVolume('music', 1);
        const handle = startMediaPlayback({ url: '/test.mp3', volume: 0.8, channel: 'music' });
        assert.equal(handle.element.volume, 0.8);

        setAudioChannelVolume('music', 0.25);
        assert.equal(handle.element.volume, 0.2);

        handle.setVolume(0.5);
        assert.equal(handle.element.volume, 0.125);

        setAudioChannelVolume('music', 1);
        assert.equal(handle.element.volume, 0.5);
        handle.stop(0);
    } finally {
        (globalThis as { window?: unknown }).window = previousWindow;
        (globalThis as { Audio?: unknown }).Audio = previousAudio;
        setAudioChannelVolume('music', 1);
    }
});
