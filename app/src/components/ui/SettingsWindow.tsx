import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FolderOpen, Grid3X3, Monitor, Shield, SlidersHorizontal, Volume2, Settings, X, Globe2, Loader2, Users, Languages, RotateCcw } from 'lucide-react';
import { yjsStore } from '../../store/yjsStore';
import { useCanvasDrawStore } from '../../store/canvasDrawStore';
import { useNotesWorkspaceStore } from '../../store/notesWorkspaceStore';
import { resetCurrentWindowLayout } from '../../store/windowStore';
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
import { getDevPerformanceOverlayEnabled, setDevPerformanceOverlayEnabled } from '../../utils/devPerformanceOverlay';
import type { AudioChannel, PlayerProfile } from '../../types';
import { isDesktopRuntime, showTranslationsFolder } from '../../services/desktopBridge';
import { listPlayerProfiles, updatePlayerProfileRole } from '../../services/fileApi';

type SettingsTabId = 'interface' | 'audio' | 'canvas' | 'world' | 'roles';

interface SettingsWindowProps {
    isOpen: boolean;
    roomName: string;
    onClose: () => void;
}

const AUDIO_CHANNELS: Array<{ id: AudioChannel; labelKey: string }> = [
    { id: 'music', labelKey: 'settings.audio.channels.music' },
    { id: 'ambience', labelKey: 'settings.audio.channels.ambience' },
    { id: 'sfx', labelKey: 'settings.audio.channels.sfx' },
    { id: 'voice', labelKey: 'settings.audio.channels.voice' },
];

const ROLE_PERMISSION_LABELS: Array<{ key: PermissionKey; labelKey: string }> = [
    { key: 'viewGeneral', labelKey: 'settings.roles.permissions.viewGeneral' },
    { key: 'editGeneral', labelKey: 'settings.roles.permissions.editGeneral' },
    { key: 'viewOwnUser', labelKey: 'settings.roles.permissions.viewOwnUser' },
    { key: 'editOwnUser', labelKey: 'settings.roles.permissions.editOwnUser' },
    { key: 'viewGm', labelKey: 'settings.roles.permissions.viewGm' },
    { key: 'broadcastAudio', labelKey: 'settings.roles.permissions.broadcastAudio' },
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
    const tabs: Array<{ id: SettingsTabId; labelKey: string; icon: typeof Monitor; gmOnly?: boolean }> = [
        { id: 'interface', labelKey: 'settings.tabs.interface', icon: Monitor },
        { id: 'audio', labelKey: 'settings.tabs.audio', icon: Volume2 },
        { id: 'canvas', labelKey: 'settings.tabs.canvas', icon: Grid3X3 },
    ];
    if (isGM) {
        tabs.push(
            { id: 'world', labelKey: 'settings.tabs.world', icon: Globe2, gmOnly: true },
            { id: 'roles', labelKey: 'settings.tabs.roles', icon: Shield, gmOnly: true },
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
    const [pdfViewerEnabled, setPdfViewerEnabled] = useAppModuleEnabled('pdfViewer');
    const [channelVolumes, setChannelVolume] = useAudioChannelVolumes();
    const [locale, setLocale] = useLocalePreference();
    const [themeId, setThemeId] = useThemePreset();
    const [densityId, setDensityId] = useInterfaceDensity();
    const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>(getStoredCustomThemeColors);
    const [localResetMessage, setLocalResetMessage] = useState('');
    const [devPerfOverlayEnabled, setDevPerfOverlayEnabled] = useState(getDevPerformanceOverlayEnabled);
    const gridEnabled = useCanvasDrawStore((state) => state.gridEnabled);
    const gridType = useCanvasDrawStore((state) => state.gridType);
    const gridSpacing = useCanvasDrawStore((state) => state.gridSpacing);
    const toggleGrid = useCanvasDrawStore((state) => state.toggleGrid);
    const setGridType = useCanvasDrawStore((state) => state.setGridType);
    const setGridSpacing = useCanvasDrawStore((state) => state.setGridSpacing);
    const notesShell = useNotesWorkspaceStore((state) => state.shell);
    const toggleNotesShellModule = useNotesWorkspaceStore((state) => state.toggleShellModule);
    const resetNotesShell = useNotesWorkspaceStore((state) => state.resetShell);
    const resetNotesLayout = useNotesWorkspaceStore((state) => state.resetLayout);
    const notesShellModules = useMemo(
        () => listImplementedNotesShellModules()
            .filter((module) => module.canToggle)
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

    useEffect(() => {
        if (!localResetMessage) return;
        const timeoutId = window.setTimeout(() => setLocalResetMessage(''), 2400);
        return () => window.clearTimeout(timeoutId);
    }, [localResetMessage]);

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
    const announceLocalReset = (message: string) => {
        setLocalResetMessage(message);
    };
    const resetThemeAndDensity = () => {
        const next = saveCustomThemeColors(DEFAULT_CUSTOM_THEME_COLORS);
        setCustomThemeColors(next);
        setThemeId(themePresets[0].id);
        setDensityId('balanced');
        announceLocalReset(t('settings.reset.messages.themeDensity'));
    };
    const resetScreenWindowLayout = () => {
        resetCurrentWindowLayout();
        announceLocalReset(t('settings.reset.messages.screenWindows'));
    };
    const resetNotesWorkspaceLayout = () => {
        resetNotesLayout();
        announceLocalReset(t('settings.reset.messages.notesLayout'));
    };
    const resetNotesWorkspaceShell = () => {
        resetNotesShell();
        announceLocalReset(t('settings.reset.messages.notesShell'));
    };
    const resetAudioSettings = () => {
        setAudioModuleEnabled(true);
        setAudioEnabled(false);
        AUDIO_CHANNELS.forEach((channel) => setChannelVolume(channel.id, 1));
        announceLocalReset(t('settings.reset.messages.audio'));
    };
    const resetAllLocalUi = () => {
        resetThemeAndDensity();
        resetCurrentWindowLayout();
        resetNotesLayout();
        resetNotesShell();
        setAudioModuleEnabled(true);
        setAudioEnabled(false);
        AUDIO_CHANNELS.forEach((channel) => setChannelVolume(channel.id, 1));
        announceLocalReset(t('settings.reset.messages.all'));
    };
    const updateDevPerfOverlay = (enabled: boolean) => {
        setDevPerfOverlayEnabled(enabled);
        setDevPerformanceOverlayEnabled(enabled);
    };
    const handleShowTranslationsFolder = async () => {
        try {
            const folder = await showTranslationsFolder();
            announceLocalReset(folder
                ? t('settings.interface.language.openFolderSuccess')
                : t('settings.interface.language.openFolderUnavailable'));
        } catch (err) {
            announceLocalReset(err instanceof Error ? err.message : String(err));
        }
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
                            <div className="truncate text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">{t('settings.title')}</div>
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
                                    {t(tab.labelKey)}
                                    {tab.gmOnly && <span className="ml-auto rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-1.5 py-0.5 text-[8px] text-[var(--vibe-warning)]">GM</span>}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <main className="flex min-w-0 flex-1 flex-col">
                    <header className="flex h-14 items-center justify-between border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-header)] px-5">
                        <div>
                            <div className="text-sm font-bold text-[var(--vibe-text-primary)]">{t(tabs.find((tab) => tab.id === safeActiveTab)?.labelKey ?? 'settings.tabs.interface')}</div>
                            <div className="text-[10px] uppercase tracking-widest text-[var(--vibe-text-faint)]">{roomName}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                            title={t('common.close')}
                        >
                            <X size={16} />
                        </button>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {safeActiveTab === 'interface' && (
                            <section className="space-y-3">
                                <div className={settingsPanelClass}>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                            <RotateCcw size={14} />
                                            {t('settings.reset.title')}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={resetAllLocalUi}
                                            className="flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] px-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-warning)_20%,transparent)]"
                                            title={t('settings.reset.allTitle')}
                                        >
                                            <RotateCcw size={12} />
                                            {t('settings.reset.allButton')}
                                        </button>
                                    </div>
                                    {localResetMessage && (
                                        <div className="mb-3 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_12%,transparent)] px-3 py-2 text-[11px] text-[var(--vibe-success)]">
                                            {localResetMessage}
                                        </div>
                                    )}
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <button
                                            type="button"
                                            onClick={resetThemeAndDensity}
                                            className={`${settingsCardClass} text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}
                                        >
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.reset.themeDensityTitle')}</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">{t('settings.reset.themeDensityDescription')}</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetScreenWindowLayout}
                                            className={`${settingsCardClass} text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}
                                        >
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.reset.screenWindowsTitle')}</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">{t('settings.reset.screenWindowsDescription')}</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetNotesWorkspaceLayout}
                                            className={`${settingsCardClass} text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}
                                        >
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.reset.notesLayoutTitle')}</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">{t('settings.reset.notesLayoutDescription')}</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetNotesWorkspaceShell}
                                            className={`${settingsCardClass} text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}
                                        >
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.reset.notesShellTitle')}</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">Vault, Context, Search, Graph, Audio</div>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetAudioSettings}
                                            className={`${settingsCardClass} text-left transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}
                                        >
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.reset.audioTitle')}</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">{t('settings.reset.audioDescription')}</div>
                                        </button>
                                        {import.meta.env.DEV && (
                                            <label className={`${settingsCardClass} flex cursor-pointer items-center justify-between gap-3 transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}>
                                                <span>
                                                    <span className="block text-xs font-bold text-[var(--vibe-text-primary)]">Dev performance overlay</span>
                                                    <span className="mt-1 block text-[11px] text-[var(--vibe-text-faint)]">{t('settings.reset.devPerfDescription')}</span>
                                                </span>
                                                <input
                                                    type="checkbox"
                                                    checked={devPerfOverlayEnabled}
                                                    onChange={(event) => updateDevPerfOverlay(event.target.checked)}
                                                    className="h-4 w-4 shrink-0 accent-[var(--vibe-accent)]"
                                                />
                                            </label>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] p-4 shadow-[var(--vibe-shadow-block)]">
                                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                        <Monitor size={14} />
                                        {t('settings.interface.localInterface')}
                                    </div>
                                    <div className="mb-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                        <div className="mb-3 flex items-end justify-between gap-3">
                                            <div>
                                                <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.interface.visualTheme')}</div>
                                                <div className="mt-1 text-[10px] text-[var(--vibe-text-faint)]">{t('settings.interface.visualThemeDescription')}</div>
                                            </div>
                                            <span className="rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-muted)]">{t('settings.interface.balancedDefault')}</span>
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
                                                        <div className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wider">
                                                            {t(`settings.interface.themePresets.${preset.id}.label`, { defaultValue: preset.label })}
                                                        </div>
                                                        <span className="rounded border border-[var(--vibe-border-subtle)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{preset.effectLevel}</span>
                                                    </div>
                                                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--vibe-accent)]">
                                                        {t(`settings.interface.themePresets.${preset.id}.tone`, { defaultValue: preset.tone })}
                                                    </div>
                                                    <div className="mt-1 text-[10px] leading-snug text-[var(--vibe-text-faint)]">
                                                        {t(`settings.interface.themePresets.${preset.id}.description`, { defaultValue: preset.description })}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-3 rounded-[var(--vibe-radius-md)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-accent-soft)] p-3">
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <div>
                                                    <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.interface.customPalette')}</div>
                                                    <div className="mt-0.5 text-[10px] text-[var(--vibe-text-faint)]">{t('settings.interface.customPaletteDescription')}</div>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={resetCustomTheme}
                                                    className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:text-[var(--vibe-text-primary)]"
                                                >
                                                    {t('common.reset')}
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
                                                    <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.interface.density')}</div>
                                                    <div className="mt-1 text-[10px] text-[var(--vibe-text-faint)]">{t('settings.interface.densityDescription')}</div>
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
                                                                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--vibe-text-primary)]">
                                                                    {t(`settings.interface.densityPresets.${preset.id}.label`, { defaultValue: preset.label })}
                                                                </span>
                                                                <span className="rounded border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                                    {t(`settings.interface.densityPresets.${preset.id}.tone`, { defaultValue: preset.tone })}
                                                                </span>
                                                            </div>
                                                            <div className="mt-2 flex items-end gap-1.5 text-[var(--vibe-accent)]">
                                                                <span className="h-3 w-2 rounded-sm bg-current opacity-45" />
                                                                <span className="h-4 w-2 rounded-sm bg-current opacity-65" />
                                                                <span className="h-5 w-2 rounded-sm bg-current opacity-85" />
                                                            </div>
                                                            <div className="mt-2 text-[10px] leading-snug text-[var(--vibe-text-faint)]">
                                                                {t(`settings.interface.densityPresets.${preset.id}.description`, { defaultValue: preset.description })}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.interface.themeCardTitle')}</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">{t('settings.interface.themeCardDescription')}</div>
                                        </div>
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.interface.accessCardTitle')}</div>
                                            <div className="mt-1 text-[11px] text-[var(--vibe-text-faint)]">{isGM ? t('settings.interface.accessGm') : t('settings.interface.accessPlayer')}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className={settingsPanelClass}>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                            <Settings size={14} />
                                            {t('settings.interface.notesModules.title')}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={resetNotesShell}
                                            className="flex h-7 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                            title={t('settings.interface.notesModules.resetTitle')}
                                        >
                                            <RotateCcw size={12} />
                                            <span>{t('settings.interface.notesModules.reset')}</span>
                                        </button>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        {notesShellModules.map((module) => {
                                            const isEnabled = notesShell.modules[module.id];
                                            const moduleArea = notesShell.moduleAreas[module.id] ?? module.defaultArea;
                                            const areaLabel = moduleArea === 'left'
                                                ? t('settings.interface.notesModules.areas.left')
                                                : moduleArea === 'center'
                                                    ? t('settings.interface.notesModules.areas.center')
                                                    : moduleArea === 'right'
                                                    ? t('settings.interface.notesModules.areas.right')
                                                    : t('settings.interface.notesModules.areas.bottom');

                                            return (
                                                <label
                                                    key={module.id}
                                                    className={`${settingsCardClass} flex cursor-pointer items-center justify-between gap-3 transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]`}
                                                >
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-xs font-bold text-[var(--vibe-text-primary)]">{t(module.labelKey)}</span>
                                                        <span className={`mt-1 block text-[10px] uppercase tracking-wider ${settingsMutedTextClass}`}>
                                                            {areaLabel}{module.canResize ? ` / ${t('settings.interface.notesModules.resizable')}` : ''}
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

                                <label className={toggleOptionClass}>
                                    <span className="flex min-w-0 items-start gap-3">
                                        <FileText size={16} className="mt-0.5 shrink-0 text-[var(--vibe-accent)]" />
                                        <span className="min-w-0">
                                            <span className="block text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">{t('settings.interface.pdfViewer.title')}</span>
                                            <span className={`mt-1 block text-[11px] ${settingsMutedTextClass}`}>{t('settings.interface.pdfViewer.description')}</span>
                                        </span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={pdfViewerEnabled}
                                        onChange={(event) => setPdfViewerEnabled(event.target.checked)}
                                        className="h-4 w-4 shrink-0 accent-[var(--vibe-accent)]"
                                    />
                                </label>

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

                                    <button
                                        type="button"
                                        disabled={!isDesktopRuntime()}
                                        onClick={handleShowTranslationsFolder}
                                        className={`mt-3 flex h-8 items-center gap-2 rounded-[var(--vibe-radius-sm)] border px-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                                            isDesktopRuntime()
                                                ? 'border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-muted)] hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]'
                                                : 'cursor-not-allowed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] text-[var(--vibe-text-faint)] opacity-45'
                                        }`}
                                        title={isDesktopRuntime()
                                            ? t('settings.interface.language.openFolderTitle')
                                            : t('settings.interface.language.openFolderUnavailable')}
                                    >
                                        <FolderOpen size={13} />
                                        {t('settings.interface.language.openFolder')}
                                    </button>

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
                                        <span className="block text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">{t('settings.audio.moduleTitle')}</span>
                                        <span className={`mt-1 block text-[11px] ${settingsMutedTextClass}`}>{t('settings.audio.moduleDescription')}</span>
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
                                        <span className="block text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-primary)]">{t('settings.audio.sessionSoundTitle')}</span>
                                        <span className={`mt-1 block text-[11px] ${settingsMutedTextClass}`}>{t('settings.audio.sessionSoundDescription')}</span>
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
                                        {t('settings.audio.mixerTitle')}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {AUDIO_CHANNELS.map((channel) => (
                                            <label key={channel.id} className={settingsCardClass}>
                                                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-[var(--vibe-text-muted)]">
                                                    <span>{t(channel.labelKey)}</span>
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
                                        {t('settings.canvas.gridSnapTitle')}
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
                                            {gridEnabled ? t('settings.canvas.gridEnabled') : t('settings.canvas.gridDisabled')}
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
                                                {type === 'square' ? t('settings.canvas.squareGrid') : t('settings.canvas.hexGrid')}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="mt-4 block max-w-xs">
                                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-[var(--vibe-text-muted)]">
                                            <span>{t('settings.canvas.gridStep')}</span>
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
                                        {t('settings.world.title')}
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className={settingsCardClass}>
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.world.room')}</div>
                                            <div className={`mt-1 truncate text-[11px] ${settingsMutedTextClass}`}>{roomName}</div>
                                        </div>
                                        <div className={settingsCardClass}>
                                            <div className="text-xs font-bold text-[var(--vibe-text-primary)]">{t('settings.world.storage')}</div>
                                            <div className={`mt-1 text-[11px] ${settingsMutedTextClass}`}>{t('settings.world.storageDescription')}</div>
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
                                        {t('settings.roles.title')}
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
                                                            {t('settings.roles.baseBadge')}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className={`mb-2 text-[11px] ${settingsMutedTextClass}`}>
                                                    {role.id === 'base-player'
                                                        ? t('settings.roles.descriptions.basePlayer')
                                                        : role.id === 'gm'
                                                            ? t('settings.roles.descriptions.gm')
                                                            : t('settings.roles.descriptions.effective')}
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
                                                            {t(permission.labelKey)}
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
                                            {t('settings.roles.players')}
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
                                                                {t('settings.roles.legacyHint')}
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
                                                {t('settings.roles.noProfiles')}
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
