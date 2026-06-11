import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Grid3X3, Monitor, Shield, SlidersHorizontal, Volume2, Settings, X, Globe2, Loader2, Users, Languages } from 'lucide-react';
import { yjsStore } from '../../store/yjsStore';
import { useCanvasDrawStore } from '../../store/canvasDrawStore';
import { useNotesWorkspaceStore } from '../../store/notesWorkspaceStore';
import { useAudioChannelVolumes } from '../../hooks/useAudioChannelVolumes';
import { useAudioSessionEnabled } from '../../hooks/useAudioSessionEnabled';
import { useAppModuleEnabled } from '../../hooks/useAppModuleEnablement';
import { useInterfaceDensity } from '../../hooks/useInterfaceDensity';
import { useLocalePreference } from '../../hooks/useLocalePreference';
import { useThemePreset } from '../../hooks/useThemePreset';
import { DEFAULT_ROLE_DEFINITIONS, getEffectivePermissions, type PermissionKey, type UserRole } from '../../utils/permissions';
import { SUPPORTED_LOCALES } from '../../utils/localization';
import { listImplementedNotesShellModules } from '../../utils/notesWorkspaceModules';
import { DEFAULT_CUSTOM_THEME_COLORS, getStoredCustomThemeColors, glass, interfaceDensityPresets, saveCustomThemeColors, themePresets, type CustomThemeColors } from '../../utils/theme';
import type { AudioChannel, PlayerProfile } from '../../types';
import { listPlayerProfiles, updatePlayerProfileRole } from '../../services/fileApi';

type SettingsTabId = 'interface' | 'audio' | 'canvas' | 'world' | 'roles';

interface SettingsWindowProps {
    isOpen: boolean;
    roomName: string;
    onClose: () => void;
}

const AUDIO_CHANNELS: Array<{ id: AudioChannel; label: string }> = [
    { id: 'music', label: 'Музыка' },
    { id: 'ambience', label: 'Атмосфера' },
    { id: 'sfx', label: 'SFX' },
    { id: 'voice', label: 'Голос' },
];

const ROLE_PERMISSION_LABELS: Array<{ key: PermissionKey; label: string }> = [
    { key: 'viewGeneral', label: 'Видит общую' },
    { key: 'editGeneral', label: 'Правит общую' },
    { key: 'viewOwnUser', label: 'Видит своё' },
    { key: 'editOwnUser', label: 'Правит своё' },
    { key: 'viewGm', label: 'Видит GM' },
    { key: 'broadcastAudio', label: 'Звук' },
];

const ASSIGNABLE_PLAYER_ROLES: Array<{ id: Exclude<UserRole, 'gm'>; label: string }> = [
    { id: 'player', label: 'Player' },
    { id: 'trusted-player', label: 'Trusted Player' },
    { id: 'spectator', label: 'Spectator' },
];

const CUSTOM_THEME_COLOR_FIELDS: Array<{ key: keyof CustomThemeColors; label: string }> = [
    { key: 'backgroundStart', label: 'BG 1' },
    { key: 'backgroundMid', label: 'BG 2' },
    { key: 'backgroundEnd', label: 'BG 3' },
    { key: 'text', label: 'Text' },
    { key: 'accent', label: 'Accent' },
    { key: 'scrollbar', label: 'Scroll' },
];

const settingsPanelClass = 'rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-4 shadow-[var(--vibe-shadow-block)]';
const settingsCardClass = 'rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3';
const settingsSectionTitleClass = 'mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]';
const settingsMutedTextClass = 'text-[var(--vibe-text-faint)]';
const toggleOptionClass = 'flex cursor-pointer items-center justify-between gap-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-4 shadow-[var(--vibe-shadow-block)]';
const activeControlClass = 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]';
const idleControlClass = 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]';

function getSettingsTabs(isGM: boolean) {
    const tabs: Array<{ id: SettingsTabId; label: string; icon: typeof Monitor; gmOnly?: boolean }> = [
        { id: 'interface', label: 'Интерфейс', icon: Monitor },
        { id: 'audio', label: 'Аудио', icon: Volume2 },
        { id: 'canvas', label: 'Canvas', icon: Grid3X3 },
    ];
    if (isGM) {
        tabs.push(
            { id: 'world', label: 'Мир', icon: Globe2, gmOnly: true },
            { id: 'roles', label: 'Роли', icon: Shield, gmOnly: true },
        );
    }
    return tabs;
}

export function SettingsWindow({ isOpen, roomName, onClose }: SettingsWindowProps) {
    const { t } = useTranslation();
    const isGM = yjsStore.localRole === 'gm';
    const tabs = useMemo(() => getSettingsTabs(isGM), [isGM]);
    const [activeTab, setActiveTab] = useState<SettingsTabId>('interface');
    const [audioEnabled, setAudioEnabled] = useAudioSessionEnabled();
    const [audioModuleEnabled, setAudioModuleEnabled] = useAppModuleEnabled('audio');
    const [channelVolumes, setChannelVolume] = useAudioChannelVolumes();
    const [locale, setLocale] = useLocalePreference();
    const [themeId, setThemeId] = useThemePreset();
    const [densityId, setDensityId] = useInterfaceDensity();
    const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>(getStoredCustomThemeColors);
    const gridEnabled = useCanvasDrawStore((state) => state.gridEnabled);
    const gridType = useCanvasDrawStore((state) => state.gridType);
    const gridSpacing = useCanvasDrawStore((state) => state.gridSpacing);
    const toggleGrid = useCanvasDrawStore((state) => state.toggleGrid);
    const setGridType = useCanvasDrawStore((state) => state.setGridType);
    const setGridSpacing = useCanvasDrawStore((state) => state.setGridSpacing);
    const notesShell = useNotesWorkspaceStore((state) => state.shell);
    const toggleNotesShellModule = useNotesWorkspaceStore((state) => state.toggleShellModule);
    const notesShellModules = useMemo(
        () => listImplementedNotesShellModules()
            .filter((module) => module.id !== 'audio' || audioModuleEnabled),
        [audioModuleEnabled]
    );

    const [playerProfiles, setPlayerProfiles] = useState<PlayerProfile[]>([]);
    const [loadingPlayerProfiles, setLoadingPlayerProfiles] = useState(false);
    const [updatingPlayerId, setUpdatingPlayerId] = useState<string | null>(null);
    const [playerProfileError, setPlayerProfileError] = useState('');

    useEffect(() => {
        if (!isOpen || !isGM || activeTab !== 'roles') return;

        let cancelled = false;
        const loadProfiles = async () => {
            setLoadingPlayerProfiles(true);
            setPlayerProfileError('');
            try {
                const profiles = await listPlayerProfiles();
                if (!cancelled) setPlayerProfiles(profiles);
            } catch (err) {
                if (!cancelled) setPlayerProfileError(err instanceof Error ? err.message : String(err));
            } finally {
                if (!cancelled) setLoadingPlayerProfiles(false);
            }
        };

        void loadProfiles();
        return () => {
            cancelled = true;
        };
    }, [activeTab, isGM, isOpen]);

    const handleUpdatePlayerRole = async (profile: PlayerProfile, role: Exclude<UserRole, 'gm'>) => {
        if (profile.legacy) return;
        try {
            setUpdatingPlayerId(profile.playerId);
            setPlayerProfileError('');
            const updatedProfile = await updatePlayerProfileRole(profile.playerId, role);
            yjsStore.setPlayerRole(updatedProfile.playerId, updatedProfile.assignedRole);
            setPlayerProfiles((profiles) => profiles.map((item) => (
                item.playerId === updatedProfile.playerId ? updatedProfile : item
            )));
        } catch (err) {
            setPlayerProfileError(err instanceof Error ? err.message : String(err));
        } finally {
            setUpdatingPlayerId(null);
        }
    };

    if (!isOpen) return null;

    const safeActiveTab = tabs.some((tab) => tab.id === activeTab) ? activeTab : 'interface';
    const updateCustomThemeColor = (key: keyof CustomThemeColors, value: string) => {
        const next = saveCustomThemeColors({ ...customThemeColors, [key]: value });
        setCustomThemeColors(next);
        setThemeId('custom');
    };
    const resetCustomTheme = () => {
        const next = saveCustomThemeColors(DEFAULT_CUSTOM_THEME_COLORS);
        setCustomThemeColors(next);
        setThemeId('custom');
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--vibe-body-bg)_58%,transparent)] p-4 backdrop-blur-sm">
            <div className="flex h-[min(720px,calc(100vh-32px))] w-[min(900px,calc(100vw-32px))] overflow-hidden rounded-[var(--vibe-radius-lg)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-window)] text-[var(--vibe-text-primary)] shadow-[var(--vibe-shadow-window)] backdrop-blur-[var(--vibe-backdrop-blur)]">
                <aside className="flex w-52 flex-col border-r border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-3">
                    <div className="mb-4 flex items-center gap-2 px-2 py-1.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-accent)]">
                            <Settings size={16} />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">Настройки</div>
                            <div className="truncate text-[10px] text-[var(--vibe-text-faint)]">{isGM ? 'GM' : 'Player'}</div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const selected = safeActiveTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex h-9 items-center gap-2 rounded-lg border px-2.5 text-left text-xs font-bold uppercase tracking-wider transition-colors ${
                                        selected
                                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]'
                                            : 'border-transparent text-[var(--vibe-text-faint)] hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                    }`}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                    {tab.gmOnly && <span className="ml-auto rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-1.5 py-0.5 text-[8px] text-[var(--vibe-warning)]">GM</span>}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <main className="flex min-w-0 flex-1 flex-col">
                    <header className="flex h-14 items-center justify-between border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)] px-5">
                        <div>
                            <div className="text-sm font-bold text-[var(--vibe-text-primary)]">{tabs.find((tab) => tab.id === safeActiveTab)?.label}</div>
                            <div className="text-[10px] uppercase tracking-widest text-[var(--vibe-text-faint)]">{roomName}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            title="Закрыть"
                        >
                            <X size={16} />
                        </button>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {safeActiveTab === 'interface' && (
                            <section className="space-y-3">
                                <div className="rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-4 shadow-[var(--vibe-shadow-block)]">
                                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                        <Monitor size={14} />
                                        Локальный интерфейс
                                    </div>
                                    <div className="mb-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                        <div className="mb-3 flex items-end justify-between gap-3">
                                            <div>
                                                <div className="text-xs font-bold text-[var(--vibe-text-primary)]">Визуальная тема</div>
                                                <div className="mt-1 text-[10px] text-[var(--vibe-text-faint)]">Меняет не только цвет, а характер рабочего стола.</div>
                                            </div>
                                            <span className="rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">balanced default</span>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {themePresets.map((preset) => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => setThemeId(preset.id)}
                                                    className={`rounded-[var(--vibe-radius-md)] border p-3 text-left transition-colors ${
                                                        themeId === preset.id
                                                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)] text-[var(--vibe-text-primary)]'
                                                            : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                                    }`}
                                                >
                                                    <div className="mb-2 flex gap-1">
                                                        {preset.swatches.map((color) => (
                                                            <span
                                                                key={color}
                                                                className="h-4 flex-1 rounded border border-[var(--vibe-border-subtle)]"
                                                                style={{ backgroundColor: color }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider">{preset.label}</div>
                                                        <span className="rounded border border-[var(--vibe-border-subtle)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{preset.effectLevel}</span>
                                                    </div>
                                                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--vibe-accent)]">{preset.tone}</div>
                                                    <div className="mt-1 text-[10px] leading-snug text-[var(--vibe-text-faint)]">{preset.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] p-3">
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="text-xs font-bold text-[var(--vibe-text-primary)]">Custom palette</div>
                                                    <div className="mt-0.5 text-[10px] text-[var(--vibe-text-faint)]">Временный редактор базовых цветов; полноценные темы мира будут отдельным срезом.</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={resetCustomTheme}
                                                    className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:text-[var(--vibe-text-primary)]"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {CUSTOM_THEME_COLOR_FIELDS.map((field) => (
                                                    <label key={field.key} className="flex min-w-0 items-center gap-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1.5">
                                                        <span className="w-12 flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{field.label}</span>
                                                        <input
                                                            type="color"
                                                            value={customThemeColors[field.key]}
                                                            onChange={(event) => updateCustomThemeColor(field.key, event.target.value)}
                                                            className="h-6 w-8 flex-shrink-0 cursor-pointer rounded border border-[var(--vibe-border-subtle)] bg-transparent p-0"
                                                            title={field.label}
                                                        />
                                                        <span className="min-w-0 truncate font-mono text-[9px] text-[var(--vibe-text-faint)]">{customThemeColors[field.key]}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="mt-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                            <div className="mb-3 flex items-end justify-between gap-3">
                                                <div>
                                                    <div className="text-xs font-bold text-[var(--vibe-text-primary)]">Плотность интерфейса</div>
                                                    <div className="mt-1 text-[10px] text-[var(--vibe-text-faint)]">Меняет отступы, высоту контролов и общий ритм панелей без смены визуальной темы.</div>
                                                </div>
                                                <SlidersHorizontal size={15} className="text-[var(--vibe-text-faint)]" />
                                            </div>
                                            <div className="grid gap-2 sm:grid-cols-3">
                                                {interfaceDensityPresets.map((preset) => {
                                                    const selected = densityId === preset.id;
                                                    return (
                                                        <button
                                                            key={preset.id}
                                                            type="button"
                                                            onClick={() => setDensityId(preset.id)}
                                                            className={`rounded-[var(--vibe-radius-md)] border p-3 text-left transition-colors ${
                                                                selected
                                                                    ? activeControlClass
                                                                    : idleControlClass
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-2">
                                                                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--vibe-text-primary)]">{preset.label}</span>
                                                                <span className="rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{preset.tone}</span>
                                                            </div>
                                                            <div className="mt-2 flex items-end gap-1.5 text-[var(--vibe-accent)]">
                                                                <span className="h-3 w-2 rounded-sm bg-current opacity-45" />
                                                                <span className="h-4 w-2 rounded-sm bg-current opacity-65" />
                                                                <span className="h-5 w-2 rounded-sm bg-current opacity-85" />
                                                            </div>
                                                            <div className="mt-2 text-[10px] leading-snug text-[var(--vibe-text-faint)]">{preset.description}</div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">Тема</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">Визуальный preset + semantic tokens</div>
                                        </div>
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">Доступ</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">{isGM ? 'Полный GM-контроль' : 'Личные настройки игрока'}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className={settingsPanelClass}>
                                    <div className={settingsSectionTitleClass}>
                                        <Settings size={14} />
                                        Модули режима заметок
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {notesShellModules.map((module) => {
                                            const isEnabled = notesShell.modules[module.id];
                                            const areaLabel = module.defaultArea === 'left'
                                                ? 'Левая панель'
                                                : module.defaultArea === 'right'
                                                    ? 'Правая панель'
                                                    : 'Нижний dock';

                                            return (
                                                <label
                                                    key={module.id}
                                                    className={`${settingsCardClass} flex cursor-pointer items-center justify-between gap-3 transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-xs font-bold text-[var(--vibe-text-primary)]">{t(module.labelKey)}</span>
                                                        <span className={`mt-1 block text-[10px] uppercase tracking-wider ${settingsMutedTextClass}`}>
                                                            {areaLabel}{module.canResize ? ' / размер' : ''}
                                                        </span>
                                                    </span>
                                                    <input
                                                        type="checkbox"
                                                        checked={isEnabled}
                                                        onChange={() => toggleNotesShellModule(module.id)}
                                                        className="h-4 w-4 shrink-0 accent-[var(--vibe-accent)]"
                                                    />
                                                </label>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={settingsPanelClass}>
                                    <div className={settingsSectionTitleClass}>
                                        <Languages size={14} />
                                        {t('settings.interface.language.title')}
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {SUPPORTED_LOCALES.map((option) => {
                                            const selected = locale === option.id;
                                            const localeSummaryKey = option.id === 'ru'
                                                ? 'settings.interface.language.localeRu'
                                                : 'settings.interface.language.localeEn';
                                            return (
                                                <button
                                                    key={option.id}
                                                    type="button"
                                                    onClick={() => setLocale(option.id)}
                                                    className={`rounded-[var(--vibe-radius-md)] border p-3 text-left transition-colors ${
                                                        selected
                                                            ? activeControlClass
                                                            : idleControlClass
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold text-[var(--vibe-text-primary)]">{option.nativeLabel}</span>
                                                        <span className="rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{option.id}</span>
                                                    </div>
                                                    <div className="mt-1 text-[10px] leading-snug text-[var(--vibe-text-faint)]">{t(localeSummaryKey)}</div>
                                                    <div className="mt-2 truncate font-mono text-[9px] text-[var(--vibe-text-faint)]">{option.bundlePath}</div>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                        <div className={settingsCardClass}>
                                            <div className="mb-1 flex items-center justify-between gap-2">
                                                <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.interface.language.appBundlesTitle')}</div>
                                                <span className="rounded border border-[color-mix(in_srgb,var(--vibe-success)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_12%,transparent)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-success)]">
                                                    {t('settings.interface.language.readyBadge')}
                                                </span>
                                            </div>
                                            <div className="text-[11px] leading-snug text-[var(--vibe-text-faint)]">{t('settings.interface.language.appBundlesDescription')}</div>
                                        </div>
                                        <div className={settingsCardClass}>
                                            <div className="mb-1 flex items-center justify-between gap-2">
                                                <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.interface.language.worldLocalesTitle')}</div>
                                                <span className="rounded border border-[color-mix(in_srgb,var(--vibe-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                                                    {t('settings.interface.language.plannedBadge')}
                                                </span>
                                            </div>
                                            <div className="text-[11px] leading-snug text-[var(--vibe-text-faint)]">{t('settings.interface.language.worldLocalesDescription')}</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'audio' && (
                            <section className="space-y-3">
                                <label className={toggleOptionClass}>
                                    <span>
                                        <span className="block text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">Аудио-модуль</span>
                                        <span className={`mt-1 block text-[11px] ${settingsMutedTextClass}`}>Нижний плеер, пульт звука и приём сессионных audio-команд</span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={audioModuleEnabled}
                                        onChange={(event) => setAudioModuleEnabled(event.target.checked)}
                                        className="h-4 w-4 accent-[var(--vibe-success)]"
                                    />
                                </label>

                                <label className={toggleOptionClass}>
                                    <span>
                                        <span className="block text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">Звук сессии</span>
                                        <span className={`mt-1 block text-[11px] ${settingsMutedTextClass}`}>Воспроизведение команд Host/GM на этом клиенте</span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={audioEnabled}
                                        disabled={!audioModuleEnabled}
                                        onChange={(event) => setAudioEnabled(event.target.checked)}
                                        className="h-4 w-4 accent-[var(--vibe-accent)]"
                                    />
                                </label>

                                <div className={settingsPanelClass}>
                                    <div className={settingsSectionTitleClass}>
                                        <SlidersHorizontal size={14} />
                                        Микшер каналов
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {AUDIO_CHANNELS.map((channel) => (
                                            <label key={channel.id} className={settingsCardClass}>
                                                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-[var(--vibe-text-muted)]">
                                                    <span>{channel.label}</span>
                                                    <span className="font-mono text-[var(--vibe-text-faint)]">{Math.round(channelVolumes[channel.id] * 100)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={channelVolumes[channel.id]}
                                                    disabled={!audioModuleEnabled}
                                                    onChange={(event) => setChannelVolume(channel.id, Number(event.target.value))}
                                                    className="h-1 w-full accent-[var(--vibe-accent)]"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'canvas' && (
                            <section className="space-y-3">
                                <div className={settingsPanelClass}>
                                    <div className={settingsSectionTitleClass}>
                                        <Grid3X3 size={14} />
                                        Сетка и snap
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={toggleGrid}
                                            className={`h-9 rounded-[var(--vibe-radius-sm)] border px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                                                gridEnabled
                                                    ? activeControlClass
                                                    : idleControlClass
                                            }`}
                                        >
                                            {gridEnabled ? 'Сетка включена' : 'Сетка выключена'}
                                        </button>
                                        {(['square', 'hex'] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setGridType(type)}
                                                className={`h-9 rounded-[var(--vibe-radius-sm)] border px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                                                    gridType === type
                                                        ? activeControlClass
                                                        : idleControlClass
                                                }`}
                                            >
                                                {type === 'square' ? 'Квадраты' : 'Гексы'}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="mt-4 block max-w-xs">
                                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--vibe-text-muted)]">
                                            <span>Шаг сетки</span>
                                            <span className="font-mono text-[var(--vibe-text-faint)]">{gridSpacing}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="16"
                                            max="160"
                                            step="2"
                                            value={gridSpacing}
                                            onChange={(event) => setGridSpacing(Number(event.target.value))}
                                            className="h-1 w-full accent-[var(--vibe-accent)]"
                                        />
                                    </label>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'world' && isGM && (
                            <section className="space-y-3">
                                <div className={settingsPanelClass}>
                                    <div className={settingsSectionTitleClass}>
                                        <Globe2 size={14} />
                                        Мир
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className={settingsCardClass}>
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">Комната</div>
                                            <div className={`mt-1 truncate text-[11px] ${settingsMutedTextClass}`}>{roomName}</div>
                                        </div>
                                        <div className={settingsCardClass}>
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">Хранилище</div>
                                            <div className={`mt-1 text-[11px] ${settingsMutedTextClass}`}>Файлы мира на Host-диске</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'roles' && isGM && (
                            <section className="space-y-3">
                                <div className={settingsPanelClass}>
                                    <div className={settingsSectionTitleClass}>
                                        <Shield size={14} />
                                        Роли
                                    </div>
                                    <div className="grid gap-3">
                                        {DEFAULT_ROLE_DEFINITIONS.map((role) => {
                                            const permissions = role.id === 'base-player'
                                                ? role.permissions
                                                : getEffectivePermissions(role.id as UserRole);
                                            return (
                                            <div key={role.id} className={settingsCardClass}>
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{role.label}</div>
                                                    {role.locked && (
                                                        <span className="rounded border border-[color-mix(in_srgb,var(--vibe-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                                                            База
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`mb-2 text-[11px] ${settingsMutedTextClass}`}>
                                                    {role.id === 'base-player'
                                                        ? 'Неснимаемая роль, которая ограничивает все обычные роли.'
                                                        : role.id === 'gm'
                                                            ? 'Полный host/workbench контроль.'
                                                            : 'Эффективные права после ограничений Base Player.'}
                                                </div>
                                                <div className="flex flex-wrap gap-1">
                                                    {ROLE_PERMISSION_LABELS.map((permission) => (
                                                        <span
                                                            key={permission.key}
                                                            className={`rounded-md border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                                                                permissions[permission.key]
                                                                    ? 'border-[color-mix(in_srgb,var(--vibe-success)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_12%,transparent)] text-[var(--vibe-success)]'
                                                                    : 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] text-[var(--vibe-text-faint)]'
                                                            }`}
                                                        >
                                                            {permission.label}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className={settingsPanelClass}>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                            <Users size={14} />
                                            Игроки
                                        </div>
                                        {loadingPlayerProfiles && <Loader2 size={14} className="animate-spin text-[var(--vibe-text-faint)]" />}
                                    </div>

                                    {playerProfileError && (
                                        <div className="mb-3 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] px-3 py-2 text-[11px] text-[var(--vibe-danger)]">
                                            {playerProfileError}
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        {playerProfiles.map((profile) => {
                                            const roleValue = profile.assignedRole === 'gm' ? 'player' : profile.assignedRole;
                                            const isUpdating = updatingPlayerId === profile.playerId;
                                            return (
                                                <div key={profile.playerId} className={`${settingsCardClass} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="truncate text-xs font-bold text-[var(--vibe-text-primary)]">{profile.displayName}</span>
                                                            {profile.legacy && (
                                                                <span className="rounded border border-[color-mix(in_srgb,var(--vibe-warning)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-warning)]">
                                                                    legacy
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 truncate font-mono text-[10px] text-[var(--vibe-text-faint)]">
                                                            {profile.playerId} · users/{profile.storageRoot}
                                                        </div>
                                                        {profile.legacy && (
                                                            <div className="mt-1 text-[10px] text-[var(--vibe-text-faint)]">
                                                                Профиль появится после входа игрока с этим именем.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isUpdating && <Loader2 size={14} className="animate-spin text-[var(--vibe-accent)]" />}
                                                        <select
                                                            value={roleValue}
                                                            disabled={profile.legacy || isUpdating}
                                                            onChange={(event) => {
                                                                void handleUpdatePlayerRole(profile, event.target.value as Exclude<UserRole, 'gm'>);
                                                            }}
                                                            className={`${glass.input} h-9 px-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-45`}
                                                        >
                                                            {ASSIGNABLE_PLAYER_ROLES.map((role) => (
                                                                <option key={role.id} value={role.id}>
                                                                    {role.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {!loadingPlayerProfiles && playerProfiles.length === 0 && (
                                            <div className={`${settingsCardClass} text-[11px] text-[var(--vibe-text-faint)]`}>
                                                Профилей пока нет. Они создаются при подключении игрока к открытому миру.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
