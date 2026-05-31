import assert from 'node:assert/strict';
import {
  buildCustomThemeVars,
  DEFAULT_CUSTOM_THEME_COLORS,
  getThemePreset,
  normalizeCustomThemeColors,
  normalizeHexColor,
  themePresets,
} from './theme';

assert.equal(normalizeHexColor('#AABBCC', '#000000'), '#aabbcc');
assert.equal(normalizeHexColor('112233', '#000000'), '#112233');
assert.equal(normalizeHexColor('#123', '#000000'), '#000000');
assert.equal(normalizeHexColor(null, '#ffffff'), '#ffffff');

assert.deepEqual(
  normalizeCustomThemeColors({
    backgroundStart: '#111111',
    backgroundMid: '222222',
    backgroundEnd: 'nope',
    text: '#eeeeee',
    accent: '#00ff88',
    scrollbar: '#555555',
  }),
  {
    ...DEFAULT_CUSTOM_THEME_COLORS,
    backgroundStart: '#111111',
    backgroundMid: '#222222',
    text: '#eeeeee',
    accent: '#00ff88',
    scrollbar: '#555555',
  }
);

const vars = buildCustomThemeVars({
  backgroundStart: '#111111',
  backgroundMid: '#222222',
  backgroundEnd: '#333333',
  text: '#eeeeee',
  accent: '#00ff88',
  scrollbar: '#555555',
});

assert.equal(vars['--vibe-body-bg'], '#111111');
assert.equal(vars['--vibe-text-primary'], '#eeeeee');
assert.equal(vars['--vibe-accent'], '#00ff88');
assert.equal(vars['--vibe-accent-soft'], 'rgba(0, 255, 136, 0.16)');
assert.equal(vars['--vibe-scrollbar-thumb'], 'rgba(85, 85, 85, 0.56)');
assert.equal(vars['--vibe-border-strong'], 'rgba(0, 255, 136, 0.34)');
assert.equal(vars['--vibe-backdrop-blur'], '28px');
assert.match(vars['--vibe-surface-window'], /rgba/);
assert.match(vars['--vibe-app-bg'], /linear-gradient/);

for (const preset of themePresets) {
  assert.equal(typeof preset.tone, 'string');
  assert.ok(preset.swatches.length >= 3);
  assert.ok(['rich', 'balanced', 'minimal'].includes(preset.effectLevel));
  assert.ok(preset.vars['--vibe-surface-window']);
  assert.ok(preset.vars['--vibe-border-subtle']);
  assert.ok(preset.vars['--vibe-shadow-window']);
}

assert.equal(getThemePreset('missing').id, themePresets[0].id);

console.log('theme tests passed');
