export const glassDark = {
    bg: 'bg-gradient-to-br from-[#061e2e] via-[#043330] to-[#091524]', // Dark cyan/blue gradient
    window: 'bg-[#151c2b]/65 backdrop-blur-3xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.8)] rounded-2xl', // Lighter window in blueish tone and slightly more transparent
    header: 'bg-white/5 border-b border-white/10 p-4 rounded-t-2xl',
    titleText: 'text-white/90 font-medium tracking-wide',
    content: 'p-6 flex flex-col gap-5',
    blockBg: 'bg-[#151620]/80 border border-white/5 rounded-xl p-4 shadow-[inset_0_2px_10px_rgba(0,0,0,0.3)]', // Darker blocks with inset shadow
    blockHeader: 'text-[10px] text-white/40 font-bold uppercase tracking-widest mb-4 flex justify-between items-center',
    input: 'bg-[#2e3145] border border-white/5 rounded-lg px-3 py-1.5 text-white/90 outline-none focus:bg-[#383c54] focus:border-white/30 transition-all font-sans hover:bg-[#34384e]', // Lighter interactive elements
};

export const glassLight = {
    bg: 'bg-gradient-to-br from-[#f8fafc] via-[#e2e8f0] to-[#cbd5e1]',
    window: 'bg-white/40 backdrop-blur-3xl border border-white/40 shadow-[0_15px_50px_rgba(0,0,0,0.1)] rounded-2xl',
    header: 'bg-white/40 border-b border-white/40 p-4 rounded-t-2xl',
    titleText: 'text-slate-800 font-medium tracking-tight',
    content: 'p-6 flex flex-col gap-6',
    blockBg: 'bg-white/30 border border-white/40 rounded-xl p-4 shadow-inner',
    blockHeader: 'text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4 flex justify-between items-center',
    input: 'bg-white/50 border border-white/40 rounded-lg px-3 py-1.5 text-slate-800 outline-none focus:bg-white/80 focus:border-indigo-500/50 transition-all font-mono',
};

export type BuiltInThemePresetId = 'deepTeal' | 'obsidianAmber' | 'graphite';
export type ThemePresetId = BuiltInThemePresetId | 'custom';

export interface ThemePreset {
    id: BuiltInThemePresetId;
    label: string;
    description: string;
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
    backgroundStart: '#061e2e',
    backgroundMid: '#043330',
    backgroundEnd: '#091524',
    text: '#f8fafc',
    accent: '#67e8f9',
    scrollbar: '#4b5563',
};

export const themePresets: ThemePreset[] = [
    {
        id: 'deepTeal',
        label: 'Deep Teal',
        description: 'Текущая холодная тёмная схема для длительной GM-сессии.',
        swatches: ['#061e2e', '#043330', '#67e8f9'],
        vars: {
            '--vibe-app-bg': 'linear-gradient(135deg, #061e2e 0%, #043330 50%, #091524 100%)',
            '--vibe-body-bg': '#061e2e',
            '--vibe-text-primary': '#f8fafc',
            '--vibe-accent': '#67e8f9',
            '--vibe-accent-soft': 'rgba(103, 232, 249, 0.16)',
            '--vibe-scrollbar-thumb': 'rgba(75, 85, 99, 0.55)',
        },
    },
    {
        id: 'obsidianAmber',
        label: 'Obsidian Amber',
        description: 'Более тёплая схема для лора, свечей и dungeon-crawl настроения.',
        swatches: ['#120f0c', '#2a1b12', '#f59e0b'],
        vars: {
            '--vibe-app-bg': 'linear-gradient(135deg, #120f0c 0%, #241713 48%, #0f172a 100%)',
            '--vibe-body-bg': '#120f0c',
            '--vibe-text-primary': '#fff7ed',
            '--vibe-accent': '#fbbf24',
            '--vibe-accent-soft': 'rgba(251, 191, 36, 0.15)',
            '--vibe-scrollbar-thumb': 'rgba(180, 83, 9, 0.48)',
        },
    },
    {
        id: 'graphite',
        label: 'Graphite',
        description: 'Нейтральная рабочая схема для плотных таблиц, карточек и поиска.',
        swatches: ['#0f172a', '#1f2937', '#a3e635'],
        vars: {
            '--vibe-app-bg': 'linear-gradient(135deg, #0f172a 0%, #111827 54%, #030712 100%)',
            '--vibe-body-bg': '#0f172a',
            '--vibe-text-primary': '#f8fafc',
            '--vibe-accent': '#a3e635',
            '--vibe-accent-soft': 'rgba(163, 230, 53, 0.14)',
            '--vibe-scrollbar-thumb': 'rgba(100, 116, 139, 0.56)',
        },
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

export function buildCustomThemeVars(colors: CustomThemeColors): Record<string, string> {
    const normalized = normalizeCustomThemeColors(colors);
    const accentRgb = hexToRgb(normalized.accent);
    const scrollbarRgb = hexToRgb(normalized.scrollbar);
    return {
        '--vibe-app-bg': `linear-gradient(135deg, ${normalized.backgroundStart} 0%, ${normalized.backgroundMid} 52%, ${normalized.backgroundEnd} 100%)`,
        '--vibe-body-bg': normalized.backgroundStart,
        '--vibe-text-primary': normalized.text,
        '--vibe-accent': normalized.accent,
        '--vibe-accent-soft': `rgba(${accentRgb.r}, ${accentRgb.g}, ${accentRgb.b}, 0.16)`,
        '--vibe-scrollbar-thumb': `rgba(${scrollbarRgb.r}, ${scrollbarRgb.g}, ${scrollbarRgb.b}, 0.56)`,
    };
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
    const vars = id === 'custom'
        ? buildCustomThemeVars(getStoredCustomThemeColors())
        : getThemePreset(id).vars;
    document.documentElement.dataset.vibeTheme = id;
    for (const [key, value] of Object.entries(vars)) {
        document.documentElement.style.setProperty(key, value);
    }
    if (typeof window !== 'undefined') window.localStorage.setItem(THEME_STORAGE_KEY, id);
}

// We will keep glass static while the app is migrated to CSS variable-backed tokens.
export const glass = glassDark;
