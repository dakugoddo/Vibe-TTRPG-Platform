export type BuiltInThemePresetId = 'universalGlass' | 'woodenTable' | 'arcaneControl' | 'rgbGameDesk' | 'lowLoad';
export type ThemePresetId = BuiltInThemePresetId | 'custom';
export type ThemeEffectLevel = 'rich' | 'balanced' | 'minimal';

export interface ThemePreset {
    id: BuiltInThemePresetId;
    label: string;
    description: string;
    tone: string;
    effectLevel: ThemeEffectLevel;
    swatches: string[];
    vars: Record<string, string>;
}

export const THEME_STORAGE_KEY = 'vibe-ui-theme-preset';
export const CUSTOM_THEME_STORAGE_KEY = 'vibe-ui-custom-theme';

export interface CustomThemeColors {
    backgroundStart: string;
    backgroundMid: string;
    backgroundEnd: string;
    text: string;
    accent: string;
    scrollbar: string;
}

export const DEFAULT_CUSTOM_THEME_COLORS: CustomThemeColors = {
    backgroundStart: '#080d13',
    backgroundMid: '#101722',
    backgroundEnd: '#182132',
    text: '#f8fafc',
    accent: '#559fff',
    scrollbar: '#94a3b8',
};

interface ThemeVarInput {
    appBg: string;
    bodyBg: string;
    textPrimary: string;
    textMuted: string;
    textFaint: string;
    accent: string;
    accent2: string;
    accent3: string;
    danger: string;
    success: string;
    warning: string;
    surfaceWindow: string;
    surfaceHeader: string;
    surfaceBlock: string;
    surfaceInput: string;
    surfaceHover: string;
    borderSubtle: string;
    borderStrong: string;
    scrollbarThumb: string;
    radiusSm: string;
    radiusMd: string;
    radiusLg: string;
    shadowWindow: string;
    shadowBlock: string;
    backdropBlur: string;
}

function buildThemeVars(input: ThemeVarInput): Record<string, string> {
    return {
        '--vibe-app-bg': input.appBg,
        '--vibe-body-bg': input.bodyBg,
        '--vibe-text-primary': input.textPrimary,
        '--vibe-text-muted': input.textMuted,
        '--vibe-text-faint': input.textFaint,
        '--vibe-accent': input.accent,
        '--vibe-accent-2': input.accent2,
        '--vibe-accent-3': input.accent3,
        '--vibe-accent-soft': rgbaFromHex(input.accent, 0.16),
        '--vibe-danger': input.danger,
        '--vibe-success': input.success,
        '--vibe-warning': input.warning,
        '--vibe-surface-window': input.surfaceWindow,
        '--vibe-surface-header': input.surfaceHeader,
        '--vibe-surface-block': input.surfaceBlock,
        '--vibe-surface-input': input.surfaceInput,
        '--vibe-surface-hover': input.surfaceHover,
        '--vibe-border-subtle': input.borderSubtle,
        '--vibe-border-strong': input.borderStrong,
        '--vibe-scrollbar-thumb': input.scrollbarThumb,
        '--vibe-radius-sm': input.radiusSm,
        '--vibe-radius-md': input.radiusMd,
        '--vibe-radius-lg': input.radiusLg,
        '--vibe-shadow-window': input.shadowWindow,
        '--vibe-shadow-block': input.shadowBlock,
        '--vibe-backdrop-blur': input.backdropBlur,
    };
}

export const themePresets: ThemePreset[] = [
    {
        id: 'universalGlass',
        label: 'Universal Glass',
        description: 'Главный ориентир: мягкое универсальное стекло, читаемые панели и спокойные пастельные акценты.',
        tone: 'Glass workspace',
        effectLevel: 'rich',
        swatches: ['#080d13', '#12161e', '#559fff', '#ff8fa5'],
        vars: buildThemeVars({
            appBg: 'radial-gradient(circle at 20% 12%, rgba(85, 159, 255, 0.28), transparent 34%), radial-gradient(circle at 82% 18%, rgba(255, 143, 165, 0.22), transparent 32%), linear-gradient(135deg, #080d13 0%, #101722 48%, #182132 100%)',
            bodyBg: '#080d13',
            textPrimary: '#f8fafc',
            textMuted: '#bdc7d3',
            textFaint: 'rgba(248, 250, 252, 0.42)',
            accent: '#559fff',
            accent2: '#ff8fa5',
            accent3: '#fcd34d',
            danger: '#fb7185',
            success: '#4ade80',
            warning: '#fcd34d',
            surfaceWindow: 'rgba(18, 22, 30, 0.62)',
            surfaceHeader: 'rgba(255, 255, 255, 0.055)',
            surfaceBlock: 'rgba(9, 13, 19, 0.68)',
            surfaceInput: 'rgba(0, 0, 0, 0.28)',
            surfaceHover: 'rgba(255, 255, 255, 0.08)',
            borderSubtle: 'rgba(255, 255, 255, 0.13)',
            borderStrong: 'rgba(255, 255, 255, 0.24)',
            scrollbarThumb: 'rgba(148, 163, 184, 0.56)',
            radiusSm: '8px',
            radiusMd: '12px',
            radiusLg: '18px',
            shadowWindow: '0 30px 70px rgba(0, 0, 0, 0.56), inset 0 1px 0 rgba(255, 255, 255, 0.16)',
            shadowBlock: 'inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 10px 28px rgba(0, 0, 0, 0.24)',
            backdropBlur: '34px',
        }),
    },
    {
        id: 'woodenTable',
        label: 'Wooden Tabletop',
        description: 'Тёплый игровой стол: дерево, бронза, пергаментные акценты без ухода в светлый режим.',
        tone: 'Tabletop desk',
        effectLevel: 'balanced',
        swatches: ['#1e110a', '#3d2619', '#bfa173', '#2d5a3f'],
        vars: buildThemeVars({
            appBg: 'linear-gradient(90deg, transparent 96%, rgba(0,0,0,0.34) 98%, rgba(255,255,255,0.025) 100%), linear-gradient(135deg, #1e110a 0%, #2b1a11 50%, #130b07 100%)',
            bodyBg: '#1e110a',
            textPrimary: '#f7edd6',
            textMuted: '#c8b89d',
            textFaint: 'rgba(247, 237, 214, 0.38)',
            accent: '#bfa173',
            accent2: '#2d5a3f',
            accent3: '#912727',
            danger: '#c24141',
            success: '#4f8d61',
            warning: '#d5a33a',
            surfaceWindow: 'rgba(43, 29, 19, 0.86)',
            surfaceHeader: 'linear-gradient(180deg, rgba(70, 48, 33, 0.64), rgba(26, 18, 12, 0.7))',
            surfaceBlock: 'rgba(20, 13, 9, 0.68)',
            surfaceInput: 'rgba(12, 8, 5, 0.62)',
            surfaceHover: 'rgba(191, 161, 115, 0.11)',
            borderSubtle: 'rgba(191, 161, 115, 0.16)',
            borderStrong: 'rgba(191, 161, 115, 0.35)',
            scrollbarThumb: 'rgba(191, 161, 115, 0.5)',
            radiusSm: '5px',
            radiusMd: '8px',
            radiusLg: '12px',
            shadowWindow: '0 20px 48px rgba(0, 0, 0, 0.66), inset 0 1px 0 rgba(255, 232, 184, 0.11)',
            shadowBlock: 'inset 0 2px 8px rgba(0,0,0,0.42), 0 8px 18px rgba(0,0,0,0.28)',
            backdropBlur: '14px',
        }),
    },
    {
        id: 'arcaneControl',
        label: 'Arcane Control',
        description: 'Сдержанный маготехнический пульт: тёмный cockpit, янтарные линии, бирюзовые сигналы.',
        tone: 'Arcane console',
        effectLevel: 'balanced',
        swatches: ['#06090b', '#0e1216', '#dfb15b', '#4ef2d2'],
        vars: buildThemeVars({
            appBg: 'radial-gradient(circle at 50% 30%, rgba(78, 242, 210, 0.06), transparent 42%), linear-gradient(rgba(223, 177, 91, 0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(223, 177, 91, 0.035) 1px, transparent 1px), #06090b',
            bodyBg: '#06090b',
            textPrimary: '#eef1f4',
            textMuted: '#a0aab5',
            textFaint: '#626f7a',
            accent: '#dfb15b',
            accent2: '#4ef2d2',
            accent3: '#ecd69a',
            danger: '#ff5c5c',
            success: '#4ade80',
            warning: '#dfb15b',
            surfaceWindow: 'rgba(15, 20, 24, 0.78)',
            surfaceHeader: 'rgba(8, 11, 14, 0.76)',
            surfaceBlock: 'rgba(8, 11, 14, 0.72)',
            surfaceInput: 'rgba(0, 0, 0, 0.36)',
            surfaceHover: 'rgba(255, 255, 255, 0.05)',
            borderSubtle: 'rgba(223, 177, 91, 0.14)',
            borderStrong: 'rgba(223, 177, 91, 0.32)',
            scrollbarThumb: 'rgba(223, 177, 91, 0.42)',
            radiusSm: '6px',
            radiusMd: '10px',
            radiusLg: '14px',
            shadowWindow: '0 18px 46px rgba(0, 0, 0, 0.68), inset 0 0 0 1px rgba(223, 177, 91, 0.03)',
            shadowBlock: 'inset 0 0 18px rgba(223, 177, 91, 0.035), 0 8px 22px rgba(0,0,0,0.32)',
            backdropBlur: '18px',
        }),
    },
    {
        id: 'rgbGameDesk',
        label: 'RGB Game Desk',
        description: 'Игровой стол с неоновыми рёбрами и RGB-акцентами, но без вырвиглазной кислотности.',
        tone: 'Game desk',
        effectLevel: 'rich',
        swatches: ['#05060c', '#111827', '#22d3ee', '#f472b6'],
        vars: buildThemeVars({
            appBg: 'radial-gradient(circle at 14% 18%, rgba(34, 211, 238, 0.2), transparent 32%), radial-gradient(circle at 88% 12%, rgba(244, 114, 182, 0.18), transparent 34%), radial-gradient(circle at 50% 100%, rgba(163, 230, 53, 0.10), transparent 40%), linear-gradient(135deg, #05060c 0%, #0f172a 54%, #060712 100%)',
            bodyBg: '#05060c',
            textPrimary: '#f8fbff',
            textMuted: '#b7c1d8',
            textFaint: 'rgba(248, 251, 255, 0.38)',
            accent: '#22d3ee',
            accent2: '#f472b6',
            accent3: '#a3e635',
            danger: '#fb7185',
            success: '#a3e635',
            warning: '#fde047',
            surfaceWindow: 'rgba(8, 11, 22, 0.72)',
            surfaceHeader: 'linear-gradient(90deg, rgba(34, 211, 238, 0.075), rgba(244, 114, 182, 0.06))',
            surfaceBlock: 'rgba(5, 8, 16, 0.72)',
            surfaceInput: 'rgba(1, 4, 12, 0.66)',
            surfaceHover: 'rgba(34, 211, 238, 0.08)',
            borderSubtle: 'rgba(125, 211, 252, 0.16)',
            borderStrong: 'rgba(244, 114, 182, 0.32)',
            scrollbarThumb: 'rgba(34, 211, 238, 0.46)',
            radiusSm: '8px',
            radiusMd: '12px',
            radiusLg: '16px',
            shadowWindow: '0 24px 70px rgba(0, 0, 0, 0.7), 0 0 24px rgba(34, 211, 238, 0.08), inset 0 1px 0 rgba(255,255,255,0.1)',
            shadowBlock: 'inset 0 0 18px rgba(34, 211, 238, 0.035), 0 8px 24px rgba(0,0,0,0.35)',
            backdropBlur: '28px',
        }),
    },
    {
        id: 'lowLoad',
        label: 'Low Load',
        description: 'Спокойная тема для слабых машин: меньше blur, теней и визуального шума.',
        tone: 'Performance',
        effectLevel: 'minimal',
        swatches: ['#0b0f14', '#141b24', '#7dd3fc', '#94a3b8'],
        vars: buildThemeVars({
            appBg: 'linear-gradient(135deg, #0b0f14 0%, #111827 55%, #070a0f 100%)',
            bodyBg: '#0b0f14',
            textPrimary: '#f8fafc',
            textMuted: '#cbd5e1',
            textFaint: 'rgba(248, 250, 252, 0.36)',
            accent: '#7dd3fc',
            accent2: '#94a3b8',
            accent3: '#fbbf24',
            danger: '#fb7185',
            success: '#86efac',
            warning: '#fbbf24',
            surfaceWindow: 'rgba(17, 24, 39, 0.96)',
            surfaceHeader: 'rgba(31, 41, 55, 0.86)',
            surfaceBlock: 'rgba(15, 23, 42, 0.92)',
            surfaceInput: 'rgba(2, 6, 23, 0.72)',
            surfaceHover: 'rgba(255, 255, 255, 0.06)',
            borderSubtle: 'rgba(148, 163, 184, 0.18)',
            borderStrong: 'rgba(125, 211, 252, 0.34)',
            scrollbarThumb: 'rgba(148, 163, 184, 0.5)',
            radiusSm: '6px',
            radiusMd: '8px',
            radiusLg: '10px',
            shadowWindow: '0 12px 28px rgba(0, 0, 0, 0.52)',
            shadowBlock: 'inset 0 1px 0 rgba(255,255,255,0.04)',
            backdropBlur: '0px',
        }),
    },
];

export function getThemePreset(id: string | null | undefined): ThemePreset {
    return themePresets.find((preset) => preset.id === id) || themePresets[0];
}

export function getStoredThemePresetId(): ThemePresetId {
    if (typeof window === 'undefined') return themePresets[0].id;
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'custom') return 'custom';
    return getThemePreset(stored).id;
}

export function normalizeHexColor(value: unknown, fallback: string): string {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase();
    if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return `#${trimmed.toLowerCase()}`;
    return fallback;
}

export function normalizeCustomThemeColors(value: unknown): CustomThemeColors {
    const source = value && typeof value === 'object' ? value as Partial<Record<keyof CustomThemeColors, unknown>> : {};
    return {
        backgroundStart: normalizeHexColor(source.backgroundStart, DEFAULT_CUSTOM_THEME_COLORS.backgroundStart),
        backgroundMid: normalizeHexColor(source.backgroundMid, DEFAULT_CUSTOM_THEME_COLORS.backgroundMid),
        backgroundEnd: normalizeHexColor(source.backgroundEnd, DEFAULT_CUSTOM_THEME_COLORS.backgroundEnd),
        text: normalizeHexColor(source.text, DEFAULT_CUSTOM_THEME_COLORS.text),
        accent: normalizeHexColor(source.accent, DEFAULT_CUSTOM_THEME_COLORS.accent),
        scrollbar: normalizeHexColor(source.scrollbar, DEFAULT_CUSTOM_THEME_COLORS.scrollbar),
    };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const normalized = normalizeHexColor(hex, '#000000').slice(1);
    return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16),
    };
}

function rgbaFromHex(hex: string, alpha: number): string {
    const rgb = hexToRgb(hex);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

export function buildCustomThemeVars(colors: CustomThemeColors): Record<string, string> {
    const normalized = normalizeCustomThemeColors(colors);
    return buildThemeVars({
        appBg: `radial-gradient(circle at 20% 12%, ${rgbaFromHex(normalized.accent, 0.18)}, transparent 36%), linear-gradient(135deg, ${normalized.backgroundStart} 0%, ${normalized.backgroundMid} 52%, ${normalized.backgroundEnd} 100%)`,
        bodyBg: normalized.backgroundStart,
        textPrimary: normalized.text,
        textMuted: rgbaFromHex(normalized.text, 0.72),
        textFaint: rgbaFromHex(normalized.text, 0.38),
        accent: normalized.accent,
        accent2: normalized.scrollbar,
        accent3: '#fcd34d',
        danger: '#fb7185',
        success: '#4ade80',
        warning: '#fcd34d',
        surfaceWindow: 'rgba(18, 22, 30, 0.68)',
        surfaceHeader: 'rgba(255, 255, 255, 0.055)',
        surfaceBlock: 'rgba(9, 13, 19, 0.7)',
        surfaceInput: 'rgba(0, 0, 0, 0.3)',
        surfaceHover: rgbaFromHex(normalized.accent, 0.1),
        borderSubtle: rgbaFromHex(normalized.text, 0.12),
        borderStrong: rgbaFromHex(normalized.accent, 0.34),
        scrollbarThumb: rgbaFromHex(normalized.scrollbar, 0.56),
        radiusSm: '8px',
        radiusMd: '12px',
        radiusLg: '18px',
        shadowWindow: '0 26px 64px rgba(0, 0, 0, 0.58), inset 0 1px 0 rgba(255,255,255,0.12)',
        shadowBlock: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 8px 24px rgba(0,0,0,0.25)',
        backdropBlur: '28px',
    });
}

export function getStoredCustomThemeColors(): CustomThemeColors {
    if (typeof window === 'undefined') return DEFAULT_CUSTOM_THEME_COLORS;
    try {
        return normalizeCustomThemeColors(JSON.parse(window.localStorage.getItem(CUSTOM_THEME_STORAGE_KEY) || '{}') as unknown);
    } catch {
        return DEFAULT_CUSTOM_THEME_COLORS;
    }
}

export function saveCustomThemeColors(colors: CustomThemeColors): CustomThemeColors {
    const normalized = normalizeCustomThemeColors(colors);
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(CUSTOM_THEME_STORAGE_KEY, JSON.stringify(normalized));
    }
    return normalized;
}

export function applyThemePreset(id: ThemePresetId): void {
    if (typeof document === 'undefined') return;
    const preset = id === 'custom' ? null : getThemePreset(id);
    const vars = id === 'custom'
        ? buildCustomThemeVars(getStoredCustomThemeColors())
        : getThemePreset(id).vars;

    document.documentElement.dataset.vibeTheme = id;
    document.documentElement.dataset.vibeEffectLevel = preset?.effectLevel || 'balanced';
    for (const [key, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(key, value);
    }
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_STORAGE_KEY, id);
}

export const glass = {
    bg: 'vibe-app-bg',
    window: 'bg-[var(--vibe-surface-window)] backdrop-blur-[var(--vibe-backdrop-blur)] border border-[var(--vibe-border-subtle)] shadow-[var(--vibe-shadow-window)] rounded-[var(--vibe-radius-lg)] text-[var(--vibe-text-primary)]',
    header: 'bg-[var(--vibe-surface-header)] border-b border-[var(--vibe-border-subtle)] p-4 rounded-t-[var(--vibe-radius-lg)]',
    titleText: 'text-[var(--vibe-text-primary)] font-semibold tracking-wide',
    content: 'p-5 flex flex-col gap-4',
    blockBg: 'bg-[var(--vibe-surface-block)] border border-[var(--vibe-border-subtle)] rounded-[var(--vibe-radius-md)] p-4 shadow-[var(--vibe-shadow-block)]',
    blockHeader: 'text-[10px] text-[var(--vibe-text-faint)] font-bold uppercase tracking-widest mb-4 flex justify-between items-center',
    input: 'bg-[var(--vibe-surface-input)] border border-[var(--vibe-border-subtle)] rounded-[var(--vibe-radius-sm)] px-3 py-1.5 text-[var(--vibe-text-primary)] outline-none focus:bg-[var(--vibe-surface-hover)] focus:border-[var(--vibe-border-strong)] transition-all font-sans hover:bg-[var(--vibe-surface-hover)]',
};

export const glassDark = glass;
export const glassLight = glass;
