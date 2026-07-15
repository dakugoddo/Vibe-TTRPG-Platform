import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, FolderOpen, Grid3X3, Monitor, Shield, SlidersHorizontal, Volume2, Settings, X, Globe2, Loader2, Users, Languages, RotateCcw } from 'lucide-react';
import { yjsStore } from '../../store/yjsStore';
import { useCanvasDrawStore } from '../../store/canvasDrawStore';
import { useNotesWorkspaceStore } from '../../store/notesWorkspaceStore';
import { useUIStore } from '../../store/uiStore';
import { resetCurrentWindowLayout } from '../../store/windowStore';
import { useAudioChannelVolumes } from '../../hooks/useAudioChannelVolumes';
import { useAudioSessionEnabled } from '../../hooks/useAudioSessionEnabled';
import { useAppModuleEnabled } from '../../hooks/useAppModuleEnablement';
import { useInterfaceDensity } from '../../hooks/useInterfaceDensity';
import { useLocalePreference } from '../../hooks/useLocalePreference';
import { useThemePreset } from '../../hooks/useThemePreset';
import { DEFAULT_ROLE_DEFINITIONS, getEffectivePermissions, type PermissionKey, type UserRole } from '../../utils/permissions';
import { SUPPORTED_LOCALES, flattenLocaleMessages, mergeLocaleMessages, normalizeLocale, unflattenLocaleMessages, type FlatLocaleMessages, type LocaleMessageTree, type SupportedLocale } from '../../utils/localization';
import { listImplementedNotesShellModules } from '../../utils/notesWorkspaceModules';
import { DEFAULT_CUSTOM_THEME_COLORS, getStoredCustomThemeColors, glass, interfaceDensityPresets, saveCustomThemeColors, themePresets, type CustomThemeColors } from '../../utils/theme';
import { getDevPerformanceOverlayEnabled, setDevPerformanceOverlayEnabled } from '../../utils/devPerformanceOverlay';
import { applyWorldLocaleOverrides, getBuiltInLocaleMessages } from '../../utils/worldLocaleRuntime';
import { WorldSheetLayoutSettings } from './WorldSheetLayoutSettings';
import type { AudioChannel, PlayerProfile } from '../../types';
import { isDesktopRuntime, showTranslationsFolder } from '../../services/desktopBridge';
import { listPlayerProfiles, listWorldLocaleFiles, readWorldLocaleFile, rollbackWorldLocaleFile, updatePlayerProfileRole, writeWorldLocaleFile, type WorldLocaleDiagnostic, type WorldLocaleFile, type WorldLocaleReadResult } from '../../services/fileApi';

type SettingsTabId = 'interface' | 'audio' | 'canvas' | 'world' | 'roles';
type WorldLocaleKeyFilterMode = 'all' | 'changed' | 'missing' | 'unknown';

interface SettingsWindowProps {
    isOpen: boolean;
    roomName: string;
    onClose: () => void;
}

interface WorldLocalePreview {
    locale: string;
    baseLocale: SupportedLocale;
    overrideKeys: number;
    mergedKeys: number;
    diagnostics: WorldLocaleDiagnostic[];
    samples: Array<{ key: string; value: string }>;
}

function isSettingsRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

const WORLD_LOCALE_KEY_FILTERS: Array<{ id: WorldLocaleKeyFilterMode; labelKey: string }> = [
    { id: 'all', labelKey: 'settings.world.localesFilterAll' },
    { id: 'changed', labelKey: 'settings.world.localesFilterChanged' },
    { id: 'missing', labelKey: 'settings.world.localesFilterMissing' },
    { id: 'unknown', labelKey: 'settings.world.localesFilterUnknown' },
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

function formatSettingsFileSize(size: number): string {
    if (size < 1024) return `${size} B`;
    return `${Math.ceil(size / 1024)} KB`;
}

function formatWorldLocaleDraft(overrides: Record<string, unknown>): string {
    return `${JSON.stringify(overrides, null, 2)}\n`;
}

function parseWorldLocaleDraftObject(draft: string): Record<string, unknown> | null {
    try {
        const parsed = JSON.parse(draft) as unknown;
        return isSettingsRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function buildWorldLocalePreview(result: WorldLocaleReadResult, baseLocale: SupportedLocale, baseBundle: LocaleMessageTree): WorldLocalePreview {
    const merged = mergeLocaleMessages(baseBundle, result.overrides);
    const overrideFlat = flattenLocaleMessages(result.overrides);
    const mergedFlat = flattenLocaleMessages(merged);

    return {
        locale: result.locale,
        baseLocale,
        overrideKeys: Object.keys(overrideFlat).length,
        mergedKeys: Object.keys(mergedFlat).length,
        diagnostics: result.diagnostics,
        samples: Object.entries(overrideFlat).slice(0, 5).map(([key, value]) => ({ key, value })),
    };
}

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
    const { t, i18n } = useTranslation();
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
    const [worldLocaleFiles, setWorldLocaleFiles] = useState<WorldLocaleFile[]>([]);
    const [loadingWorldLocales, setLoadingWorldLocales] = useState(false);
    const [worldLocaleError, setWorldLocaleError] = useState('');
    const [selectedWorldLocale, setSelectedWorldLocale] = useState('');
    const [loadingWorldLocalePreview, setLoadingWorldLocalePreview] = useState(false);
    const [worldLocalePreview, setWorldLocalePreview] = useState<WorldLocalePreview | null>(null);
    const [worldLocaleDraft, setWorldLocaleDraft] = useState('');
    const [worldLocaleDraftError, setWorldLocaleDraftError] = useState('');
    const [savingWorldLocale, setSavingWorldLocale] = useState(false);
    const [worldLocaleSaveMessage, setWorldLocaleSaveMessage] = useState('');
    const [worldLocaleKeyFilter, setWorldLocaleKeyFilter] = useState('');
    const [worldLocaleKeyFilterMode, setWorldLocaleKeyFilterMode] = useState<WorldLocaleKeyFilterMode>('all');
    const worldLocaleImportInputRef = useRef<HTMLInputElement | null>(null);
    const openConfirm = useUIStore((state) => state.openConfirm);
    const worldLocaleBaseFlat = useMemo(
        () => worldLocalePreview ? flattenLocaleMessages(getBuiltInLocaleMessages(worldLocalePreview.baseLocale)) : {},
        [worldLocalePreview],
    );
    const worldLocaleDraftFlat = useMemo<FlatLocaleMessages>(
        () => flattenLocaleMessages(parseWorldLocaleDraftObject(worldLocaleDraft) ?? {}),
        [worldLocaleDraft],
    );
    const worldLocaleEditorRows = useMemo(() => {
        const query = worldLocaleKeyFilter.trim().toLowerCase();
        const keys = Array.from(new Set([
            ...Object.keys(worldLocaleBaseFlat),
            ...Object.keys(worldLocaleDraftFlat),
        ])).sort((left, right) => left.localeCompare(right, locale));
        const keysByMode = keys.filter((key) => {
            const hasBase = Object.prototype.hasOwnProperty.call(worldLocaleBaseFlat, key);
            const hasOverride = Object.prototype.hasOwnProperty.call(worldLocaleDraftFlat, key);
            if (worldLocaleKeyFilterMode === 'changed') return hasOverride;
            if (worldLocaleKeyFilterMode === 'missing') return hasBase && !hasOverride;
            if (worldLocaleKeyFilterMode === 'unknown') return !hasBase && hasOverride;
            return true;
        });
        const filteredKeys = query
            ? keysByMode.filter((key) => (
                key.toLowerCase().includes(query)
                || worldLocaleBaseFlat[key]?.toLowerCase().includes(query)
                || worldLocaleDraftFlat[key]?.toLowerCase().includes(query)
            ))
            : keysByMode;

        return {
            total: filteredKeys.length,
            rows: filteredKeys.slice(0, 80).map((key) => ({
                key,
                baseValue: worldLocaleBaseFlat[key] ?? '',
                overrideValue: worldLocaleDraftFlat[key] ?? '',
                changed: Object.prototype.hasOwnProperty.call(worldLocaleDraftFlat, key),
            })),
        };
    }, [locale, worldLocaleBaseFlat, worldLocaleDraftFlat, worldLocaleKeyFilter, worldLocaleKeyFilterMode]);

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
        if (!isOpen || !isGM || activeTab !== 'world') return;

        let cancelled = false;
        const loadWorldLocales = async () => {
            setLoadingWorldLocales(true);
            setWorldLocaleError('');
            try {
                const files = await listWorldLocaleFiles();
                if (!cancelled) {
                    setWorldLocaleFiles(files);
                    setSelectedWorldLocale((current) => {
                        if (current && files.some((file) => file.locale === current)) return current;
                        return files[0]?.locale ?? '';
                    });
                }
            } catch (err) {
                if (!cancelled) setWorldLocaleError(err instanceof Error ? err.message : String(err));
            } finally {
                if (!cancelled) setLoadingWorldLocales(false);
            }
        };

        void loadWorldLocales();
        return () => {
            cancelled = true;
        };
    }, [activeTab, isGM, isOpen]);

    useEffect(() => {
        if (!isOpen || !isGM || activeTab !== 'world' || !selectedWorldLocale) {
            setWorldLocalePreview(null);
            return;
        }

        let cancelled = false;
        const loadWorldLocalePreview = async () => {
            setLoadingWorldLocalePreview(true);
            try {
                const result = await readWorldLocaleFile(selectedWorldLocale);
                if (cancelled) return;

                if (!result?.exists) {
                    setWorldLocalePreview(null);
                    return;
                }

                const baseLocale = normalizeLocale(result.locale);
                const baseBundle = getBuiltInLocaleMessages(baseLocale);
                setWorldLocalePreview(buildWorldLocalePreview(result, baseLocale, baseBundle));
                setWorldLocaleDraft(formatWorldLocaleDraft(result.overrides));
                setWorldLocaleDraftError('');
                setWorldLocaleSaveMessage('');
                setWorldLocaleKeyFilter('');
                setWorldLocaleKeyFilterMode('all');
            } catch (err) {
                if (!cancelled) setWorldLocaleError(err instanceof Error ? err.message : String(err));
            } finally {
                if (!cancelled) setLoadingWorldLocalePreview(false);
            }
        };

        void loadWorldLocalePreview();
        return () => {
            cancelled = true;
        };
    }, [activeTab, i18n, isGM, isOpen, selectedWorldLocale]);

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

    const parseWorldLocaleDraft = (): Record<string, unknown> | null => {
        const parsed = parseWorldLocaleDraftObject(worldLocaleDraft);
        if (!parsed) {
            setWorldLocaleDraftError(t('settings.world.localesEditorObjectError'));
            return null;
        }
        setWorldLocaleDraftError('');
        return parsed;
    };

    const setWorldLocaleDraftKey = (key: string, value: string) => {
        const parsed = parseWorldLocaleDraft();
        if (!parsed) return;

        const nextFlat = flattenLocaleMessages(parsed);
        if (value === '') {
            delete nextFlat[key];
        } else {
            nextFlat[key] = value;
        }
        setWorldLocaleDraft(formatWorldLocaleDraft(unflattenLocaleMessages(nextFlat)));
        setWorldLocaleDraftError('');
        setWorldLocaleSaveMessage('');
    };

    const resetWorldLocaleDraftKey = (key: string) => {
        const parsed = parseWorldLocaleDraft();
        if (!parsed) return;

        const nextFlat = flattenLocaleMessages(parsed);
        delete nextFlat[key];
        setWorldLocaleDraft(formatWorldLocaleDraft(unflattenLocaleMessages(nextFlat)));
        setWorldLocaleDraftError('');
        setWorldLocaleSaveMessage('');
    };

    const saveWorldLocaleDraft = async (overrides: Record<string, unknown>) => {
        if (!selectedWorldLocale) return;

        setSavingWorldLocale(true);
        setWorldLocaleSaveMessage('');
        try {
            const saved = await writeWorldLocaleFile(selectedWorldLocale, overrides);
            if (!saved) {
                setWorldLocaleDraftError(t('settings.world.localesSaveUnavailable'));
                return;
            }

            const baseLocale = normalizeLocale(saved.locale);
            const baseBundle = getBuiltInLocaleMessages(baseLocale);
            setWorldLocalePreview(buildWorldLocalePreview(saved, baseLocale, baseBundle));
            applyWorldLocaleOverrides(i18n, saved.locale, saved.overrides);
            yjsStore.publishWorldLocaleSnapshot({
                locale: saved.locale,
                exists: saved.exists,
                overrides: saved.overrides,
                diagnostics: saved.diagnostics,
            });
            setWorldLocaleDraft(formatWorldLocaleDraft(saved.overrides));
            setWorldLocaleDraftError('');
            setWorldLocaleSaveMessage(saved.backupCreated
                ? t('settings.world.localesSavedWithBackup')
                : t('settings.world.localesSaved'));
            setWorldLocaleFiles(await listWorldLocaleFiles());
        } catch (err) {
            setWorldLocaleDraftError(err instanceof Error ? err.message : String(err));
        } finally {
            setSavingWorldLocale(false);
        }
    };

    const rollbackSelectedWorldLocale = async () => {
        if (!selectedWorldLocale) return;

        setSavingWorldLocale(true);
        setWorldLocaleSaveMessage('');
        setWorldLocaleDraftError('');
        try {
            const restored = await rollbackWorldLocaleFile(selectedWorldLocale);
            if (!restored) {
                setWorldLocaleDraftError(t('settings.world.localesSaveUnavailable'));
                return;
            }

            const baseLocale = normalizeLocale(restored.locale);
            const baseBundle = getBuiltInLocaleMessages(baseLocale);
            setWorldLocalePreview(buildWorldLocalePreview(restored, baseLocale, baseBundle));
            applyWorldLocaleOverrides(i18n, restored.locale, restored.overrides);
            yjsStore.publishWorldLocaleSnapshot({
                locale: restored.locale,
                exists: restored.exists,
                overrides: restored.overrides,
                diagnostics: restored.diagnostics,
            });
            setWorldLocaleDraft(formatWorldLocaleDraft(restored.overrides));
            setWorldLocaleSaveMessage(t('settings.world.localesRollbackSuccess'));
            setWorldLocaleFiles(await listWorldLocaleFiles());
        } catch (err) {
            setWorldLocaleDraftError(err instanceof Error ? err.message : String(err));
        } finally {
            setSavingWorldLocale(false);
        }
    };

    const confirmSaveWorldLocaleDraft = () => {
        const overrides = parseWorldLocaleDraft();
        if (!overrides || !selectedWorldLocale) return;

        openConfirm({
            title: t('settings.world.localesSaveConfirmTitle'),
            description: t('settings.world.localesSaveConfirmDescription', { locale: selectedWorldLocale }),
            confirmText: t('settings.world.localesSaveButton'),
            cancelText: t('common.cancel'),
            onConfirm: () => void saveWorldLocaleDraft(overrides),
        });
    };

    const confirmRollbackWorldLocale = () => {
        if (!selectedWorldLocale) return;

        openConfirm({
            title: t('settings.world.localesRollbackConfirmTitle'),
            description: t('settings.world.localesRollbackConfirmDescription', { locale: selectedWorldLocale }),
            confirmText: t('settings.world.localesRollbackButton'),
            cancelText: t('common.cancel'),
            isDestructive: true,
            onConfirm: () => void rollbackSelectedWorldLocale(),
        });
    };

    const exportWorldLocaleDraft = () => {
        const overrides = parseWorldLocaleDraft();
        if (!overrides || !selectedWorldLocale) return;

        const blob = new Blob([formatWorldLocaleDraft(overrides)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${selectedWorldLocale}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setWorldLocaleSaveMessage(t('settings.world.localesExported'));
    };

    const importWorldLocaleDraft = async (file: File) => {
        try {
            const parsed = JSON.parse(await file.text()) as unknown;
            if (!isSettingsRecord(parsed)) {
                setWorldLocaleDraftError(t('settings.world.localesEditorObjectError'));
                return;
            }
            setWorldLocaleDraft(formatWorldLocaleDraft(parsed));
            setWorldLocaleDraftError('');
            setWorldLocaleSaveMessage(t('settings.world.localesImported'));
        } catch (err) {
            setWorldLocaleDraftError(err instanceof Error ? err.message : String(err));
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
                                <WorldSheetLayoutSettings roomName={roomName} />
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

                                <div className={settingsPanelClass}>
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                            <Languages size={14} />
                                            {t('settings.world.localesTitle')}
                                        </div>
                                        {loadingWorldLocales ? (
                                            <Loader2 size={14} className="animate-spin text-[var(--vibe-text-faint)]" />
                                        ) : (
                                            <span className="rounded border border-[color-mix(in_srgb,var(--vibe-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--vibe-accent)_12%,transparent)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--vibe-accent)]">
                                                {t('settings.world.localesReadOnlyBadge')}
                                            </span>
                                        )}
                                    </div>
                                    <div className={`mb-3 text-[11px] ${settingsMutedTextClass}`}>{t('settings.world.localesDescription')}</div>

                                    {worldLocaleError ? (
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] px-3 py-2 text-[11px] text-[var(--vibe-danger)]">
                                            {worldLocaleError}
                                        </div>
                                    ) : worldLocaleFiles.length === 0 ? (
                                        <div className="rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-3 text-[11px] italic text-[var(--vibe-text-faint)]">
                                            {loadingWorldLocales ? t('settings.world.localesLoading') : t('settings.world.localesEmpty')}
                                        </div>
                                    ) : (
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            {worldLocaleFiles.map((file) => (
                                                <button
                                                    key={file.locale}
                                                    type="button"
                                                    aria-pressed={selectedWorldLocale === file.locale}
                                                    onClick={() => setSelectedWorldLocale(file.locale)}
                                                    className={`${settingsCardClass} text-left transition-colors ${
                                                        selectedWorldLocale === file.locale
                                                            ? 'border-[var(--vibe-border-strong)] bg-[var(--vibe-accent-soft)]'
                                                            : 'hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)]'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-xs font-bold text-[var(--vibe-text-primary)]">{file.locale}</span>
                                                        <span className="font-mono text-[9px] text-[var(--vibe-text-faint)]">{formatSettingsFileSize(file.size)}</span>
                                                    </div>
                                                    <div className="mt-1 truncate font-mono text-[10px] text-[var(--vibe-text-faint)]">{file.filename}</div>
                                                </button>
                                            ))}
                                        </div>
                                    )}

                                    {selectedWorldLocale && (
                                        <div className="mt-3 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-3">
                                            <div className="mb-2 flex items-center justify-between gap-3">
                                                <div className="text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">
                                                    {t('settings.world.localesPreviewTitle')}
                                                </div>
                                                {loadingWorldLocalePreview && <Loader2 size={13} className="animate-spin text-[var(--vibe-text-faint)]" />}
                                            </div>

                                            {!loadingWorldLocalePreview && worldLocalePreview ? (
                                                <div className="space-y-3">
                                                    <div className="grid gap-2 sm:grid-cols-3">
                                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-2">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesBaseLocale')}</div>
                                                            <div className="mt-1 font-mono text-xs text-[var(--vibe-text-primary)]">{worldLocalePreview.baseLocale}</div>
                                                        </div>
                                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-2">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesOverrideKeys')}</div>
                                                            <div className="mt-1 font-mono text-xs text-[var(--vibe-text-primary)]">{worldLocalePreview.overrideKeys}</div>
                                                        </div>
                                                        <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-2">
                                                            <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesMergedKeys')}</div>
                                                            <div className="mt-1 font-mono text-xs text-[var(--vibe-text-primary)]">{worldLocalePreview.mergedKeys}</div>
                                                        </div>
                                                    </div>

                                                    <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-2">
                                                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesDiagnosticsTitle')}</div>
                                                        {worldLocalePreview.diagnostics.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {worldLocalePreview.diagnostics.map((diagnostic, index) => (
                                                                    <div key={`${diagnostic.level}-${index}`} className="text-[10px] text-[var(--vibe-danger)]">
                                                                        {diagnostic.message}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-[var(--vibe-text-faint)]">{t('settings.world.localesNoDiagnostics')}</div>
                                                        )}
                                                    </div>

                                                    <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-2">
                                                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesSampleTitle')}</div>
                                                        {worldLocalePreview.samples.length > 0 ? (
                                                            <div className="space-y-1">
                                                                {worldLocalePreview.samples.map((sample) => (
                                                                    <div key={sample.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 font-mono text-[10px]">
                                                                        <span className="truncate text-[var(--vibe-text-faint)]">{sample.key}</span>
                                                                        <span className="truncate text-[var(--vibe-text-primary)]">{sample.value}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="text-[10px] text-[var(--vibe-text-faint)]">{t('settings.world.localesNoOverrides')}</div>
                                                        )}
                                                    </div>

                                                    <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-2">
                                                        <div className="mb-2 flex items-center justify-between gap-2">
                                                            <div>
                                                                <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesEditorTitle')}</div>
                                                                <div className="mt-0.5 text-[10px] text-[var(--vibe-text-faint)]">{t('settings.world.localesEditorDescription')}</div>
                                                            </div>
                                                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                                                                <input
                                                                    ref={worldLocaleImportInputRef}
                                                                    type="file"
                                                                    accept="application/json,.json"
                                                                    className="hidden"
                                                                    onChange={(event) => {
                                                                        const file = event.target.files?.[0];
                                                                        event.currentTarget.value = '';
                                                                        if (file) void importWorldLocaleDraft(file);
                                                                    }}
                                                                />
                                                                <button
                                                                    type="button"
                                                                    disabled={savingWorldLocale}
                                                                    onClick={() => worldLocaleImportInputRef.current?.click()}
                                                                    className="flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
                                                                >
                                                                    {t('settings.world.localesImportButton')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={savingWorldLocale}
                                                                    onClick={exportWorldLocaleDraft}
                                                                    className="flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-45"
                                                                >
                                                                    {t('settings.world.localesExportButton')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={savingWorldLocale}
                                                                    onClick={confirmRollbackWorldLocale}
                                                                    className="flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-warning)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-warning)_12%,transparent)] px-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-warning)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-warning)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
                                                                >
                                                                    {t('settings.world.localesRollbackButton')}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    disabled={savingWorldLocale}
                                                                    onClick={confirmSaveWorldLocaleDraft}
                                                                    className="flex h-8 items-center gap-1.5 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-accent)_32%,transparent)] bg-[color-mix(in_srgb,var(--vibe-accent)_12%,transparent)] px-2.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-accent)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-45"
                                                                >
                                                                    {savingWorldLocale && <Loader2 size={12} className="animate-spin" />}
                                                                    {t('settings.world.localesSaveButton')}
                                                                </button>
                                                            </div>
                                                        </div>
                                                        {worldLocaleSaveMessage && (
                                                            <div className="mb-2 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-success)_12%,transparent)] px-2 py-1.5 text-[10px] text-[var(--vibe-success)]">
                                                                {worldLocaleSaveMessage}
                                                            </div>
                                                        )}
                                                        {worldLocaleDraftError && (
                                                            <div className="mb-2 rounded-[var(--vibe-radius-sm)] border border-[color-mix(in_srgb,var(--vibe-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--vibe-danger)_12%,transparent)] px-2 py-1.5 text-[10px] text-[var(--vibe-danger)]">
                                                                {worldLocaleDraftError}
                                                            </div>
                                                        )}
                                                        <div className="mb-2 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)]">
                                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--vibe-border-subtle)] px-2 py-2">
                                                                <div>
                                                                    <div className="text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesTableTitle')}</div>
                                                                    <div className="mt-0.5 text-[10px] text-[var(--vibe-text-faint)]">{t('settings.world.localesTableDescription')}</div>
                                                                </div>
                                                                <input
                                                                    value={worldLocaleKeyFilter}
                                                                    onChange={(event) => setWorldLocaleKeyFilter(event.target.value)}
                                                                    placeholder={t('settings.world.localesTableSearch')}
                                                                    className="h-8 min-w-48 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 font-mono text-[10px] text-[var(--vibe-text-primary)] outline-none transition-colors placeholder:text-[var(--vibe-text-faint)] focus:border-[var(--vibe-border-strong)]"
                                                                />
                                                            </div>
                                                            <div className="flex flex-wrap gap-1 border-b border-[var(--vibe-border-subtle)] px-2 py-1.5">
                                                                {WORLD_LOCALE_KEY_FILTERS.map((filter) => (
                                                                    <button
                                                                        key={filter.id}
                                                                        type="button"
                                                                        aria-pressed={worldLocaleKeyFilterMode === filter.id}
                                                                        onClick={() => setWorldLocaleKeyFilterMode(filter.id)}
                                                                        className={`h-7 rounded-[var(--vibe-radius-sm)] border px-2 text-[9px] font-bold uppercase tracking-wider transition-colors ${
                                                                            worldLocaleKeyFilterMode === filter.id ? activeControlClass : idleControlClass
                                                                        }`}
                                                                    >
                                                                        {t(filter.labelKey)}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            <div className="max-h-72 overflow-auto">
                                                                <div className="sticky top-0 z-10 grid grid-cols-[minmax(150px,0.9fr)_minmax(160px,1fr)_minmax(180px,1.1fr)_40px] gap-2 border-b border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-block)] px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">
                                                                    <div>{t('settings.world.localesTableKey')}</div>
                                                                    <div>{t('settings.world.localesTableBuiltIn')}</div>
                                                                    <div>{t('settings.world.localesTableOverride')}</div>
                                                                    <div className="text-right">{t('settings.world.localesTableReset')}</div>
                                                                </div>
                                                                {worldLocaleEditorRows.rows.length > 0 ? (
                                                                    <div className="divide-y divide-[var(--vibe-border-subtle)]">
                                                                        {worldLocaleEditorRows.rows.map((row) => (
                                                                            <div key={row.key} className="grid grid-cols-[minmax(150px,0.9fr)_minmax(160px,1fr)_minmax(180px,1.1fr)_40px] gap-2 px-2 py-1.5 text-[10px]">
                                                                                <div className="min-w-0 font-mono text-[var(--vibe-text-faint)]" title={row.key}>
                                                                                    <div className="truncate">{row.key}</div>
                                                                                </div>
                                                                                <div className="min-w-0 text-[var(--vibe-text-muted)]" title={row.baseValue}>
                                                                                    <div className="truncate">{row.baseValue}</div>
                                                                                </div>
                                                                                <input
                                                                                    value={row.overrideValue}
                                                                                    onChange={(event) => setWorldLocaleDraftKey(row.key, event.target.value)}
                                                                                    placeholder={row.baseValue}
                                                                                    className={`h-7 min-w-0 rounded-[var(--vibe-radius-sm)] border bg-[var(--vibe-surface-block)] px-2 text-[10px] text-[var(--vibe-text-primary)] outline-none transition-colors placeholder:text-[var(--vibe-text-faint)] focus:border-[var(--vibe-border-strong)] ${
                                                                                        row.changed ? 'border-[color-mix(in_srgb,var(--vibe-accent)_38%,transparent)]' : 'border-[var(--vibe-border-subtle)]'
                                                                                    }`}
                                                                                />
                                                                                <button
                                                                                    type="button"
                                                                                    disabled={!row.changed}
                                                                                    onClick={() => resetWorldLocaleDraftKey(row.key)}
                                                                                    className="flex h-7 w-7 items-center justify-center justify-self-end rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] text-[var(--vibe-text-faint)] transition-colors hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-35"
                                                                                    title={t('settings.world.localesTableReset')}
                                                                                >
                                                                                    <X size={12} />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="px-2 py-3 text-[10px] italic text-[var(--vibe-text-faint)]">{t('settings.world.localesTableEmpty')}</div>
                                                                )}
                                                            </div>
                                                            {worldLocaleEditorRows.total > worldLocaleEditorRows.rows.length && (
                                                                <div className="border-t border-[var(--vibe-border-subtle)] px-2 py-1.5 text-[10px] text-[var(--vibe-text-faint)]">
                                                                    {t('settings.world.localesTableLimited', { shown: worldLocaleEditorRows.rows.length, total: worldLocaleEditorRows.total })}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className="mb-1 text-[9px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('settings.world.localesJsonFallback')}</div>
                                                        <textarea
                                                            value={worldLocaleDraft}
                                                            onChange={(event) => {
                                                                setWorldLocaleDraft(event.target.value);
                                                                setWorldLocaleDraftError('');
                                                                setWorldLocaleSaveMessage('');
                                                            }}
                                                            spellCheck={false}
                                                            className="h-44 w-full resize-y rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-2 font-mono text-[11px] leading-relaxed text-[var(--vibe-text-primary)] outline-none transition-colors placeholder:text-[var(--vibe-text-faint)] focus:border-[var(--vibe-border-strong)]"
                                                        />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="text-[11px] italic text-[var(--vibe-text-faint)]">{t('settings.world.localesPreviewLoading')}</div>
                                            )}
                                        </div>
                                    )}
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
