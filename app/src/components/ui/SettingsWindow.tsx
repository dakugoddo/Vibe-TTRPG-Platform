import { useEffect, useMemo, useState } from 'react';
import { Grid3X3, Monitor, Shield, SlidersHorizontal, Volume2, Settings, X, Globe2, Loader2, Users } from 'lucide-react';
import { yjsStore } from '../../store/yjsStore';
import { useCanvasDrawStore } from '../../store/canvasDrawStore';
import { useAudioChannelVolumes } from '../../hooks/useAudioChannelVolumes';
import { useAudioSessionEnabled } from '../../hooks/useAudioSessionEnabled';
import { useAppModuleEnabled } from '../../hooks/useAppModuleEnablement';
import { useThemePreset } from '../../hooks/useThemePreset';
import { DEFAULT_ROLE_DEFINITIONS, getEffectivePermissions, type PermissionKey, type UserRole } from '../../utils/permissions';
import { DEFAULT_CUSTOM_THEME_COLORS, getStoredCustomThemeColors, saveCustomThemeColors, themePresets, type CustomThemeColors } from '../../utils/theme';
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
    const isGM = yjsStore.localRole === 'gm';
    const tabs = useMemo(() => getSettingsTabs(isGM), [isGM]);
    const [activeTab, setActiveTab] = useState<SettingsTabId>('interface');
    const [audioEnabled, setAudioEnabled] = useAudioSessionEnabled();
    const [audioModuleEnabled, setAudioModuleEnabled] = useAppModuleEnabled('audio');
    const [channelVolumes, setChannelVolume] = useAudioChannelVolumes();
    const [themeId, setThemeId] = useThemePreset();
    const [customThemeColors, setCustomThemeColors] = useState<CustomThemeColors>(getStoredCustomThemeColors);
    const gridEnabled = useCanvasDrawStore((state) => state.gridEnabled);
    const gridType = useCanvasDrawStore((state) => state.gridType);
    const gridSpacing = useCanvasDrawStore((state) => state.gridSpacing);
    const toggleGrid = useCanvasDrawStore((state) => state.toggleGrid);
    const setGridType = useCanvasDrawStore((state) => state.setGridType);
    const setGridSpacing = useCanvasDrawStore((state) => state.setGridSpacing);

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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
            <div className="flex h-[min(720px,calc(100vh-32px))] w-[min(860px,calc(100vw-32px))] overflow-hidden rounded-2xl border border-white/10 bg-[#101722]/95 shadow-[0_28px_80px_rgba(0,0,0,0.75)]">
                <aside className="flex w-48 flex-col border-r border-white/10 bg-white/[0.03] p-3">
                    <div className="mb-4 flex items-center gap-2 px-2 py-1.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                            <Settings size={16} />
                        </div>
                        <div className="min-w-0">
                            <div className="truncate text-xs font-bold uppercase tracking-widest text-white/80">Настройки</div>
                            <div className="truncate text-[10px] text-white/35">{isGM ? 'GM' : 'Player'}</div>
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
                                            ? 'border-cyan-200/30 bg-cyan-300/15 text-cyan-50'
                                            : 'border-transparent text-white/45 hover:border-white/10 hover:bg-white/5 hover:text-white/75'
                                    }`}
                                >
                                    <Icon size={14} />
                                    {tab.label}
                                    {tab.gmOnly && <span className="ml-auto rounded bg-amber-300/10 px-1.5 py-0.5 text-[8px] text-amber-100/70">GM</span>}
                                </button>
                            );
                        })}
                    </div>
                </aside>

                <main className="flex min-w-0 flex-1 flex-col">
                    <header className="flex h-14 items-center justify-between border-b border-white/10 px-5">
                        <div>
                            <div className="text-sm font-bold text-white/90">{tabs.find((tab) => tab.id === safeActiveTab)?.label}</div>
                            <div className="text-[10px] uppercase tracking-widest text-white/35">{roomName}</div>
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-white/25 hover:bg-white/10 hover:text-white"
                            title="Закрыть"
                        >
                            <X size={16} />
                        </button>
                    </header>

                    <div className="min-h-0 flex-1 overflow-y-auto p-5 custom-scrollbar">
                        {safeActiveTab === 'interface' && (
                            <section className="space-y-3">
                                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        <Monitor size={14} />
                                        Локальный интерфейс
                                    </div>
                                    <div className="mb-3 rounded-lg border border-white/10 bg-black/20 p-3">
                                        <div className="mb-3 text-xs font-bold text-white/75">Theme preset</div>
                                        <div className="grid gap-2 sm:grid-cols-3">
                                            {themePresets.map((preset) => (
                                                <button
                                                    key={preset.id}
                                                    type="button"
                                                    onClick={() => setThemeId(preset.id)}
                                                    className={`rounded-lg border p-3 text-left transition-colors ${
                                                        themeId === preset.id
                                                            ? 'border-cyan-200/35 bg-cyan-300/15 text-white'
                                                            : 'border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:bg-white/[0.06] hover:text-white/85'
                                                    }`}
                                                >
                                                    <div className="mb-2 flex gap-1">
                                                        {preset.swatches.map((color) => (
                                                            <span
                                                                key={color}
                                                                className="h-4 flex-1 rounded border border-white/10"
                                                                style={{ backgroundColor: color }}
                                                            />
                                                        ))}
                                                    </div>
                                                    <div className="text-[11px] font-bold uppercase tracking-wider">{preset.label}</div>
                                                    <div className="mt-1 text-[10px] leading-snug text-white/40">{preset.description}</div>
                                                </button>
                                            ))}
                                        </div>
                                        <div className="mt-3 rounded-lg border border-cyan-200/15 bg-cyan-300/5 p-3">
                                            <div className="mb-2 flex items-center justify-between gap-2">
                                                <div className="text-xs font-bold text-white/75">Custom palette</div>
                                                <button
                                                    type="button"
                                                    onClick={resetCustomTheme}
                                                    className="rounded-md border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white/45 transition-colors hover:border-white/25 hover:text-white/75"
                                                >
                                                    Reset
                                                </button>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                                {CUSTOM_THEME_COLOR_FIELDS.map((field) => (
                                                    <label key={field.key} className="flex min-w-0 items-center gap-2 rounded-md border border-white/10 bg-black/20 px-2 py-1.5">
                                                        <span className="w-12 flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-white/40">{field.label}</span>
                                                        <input
                                                            type="color"
                                                            value={customThemeColors[field.key]}
                                                            onChange={(event) => updateCustomThemeColor(field.key, event.target.value)}
                                                            className="h-6 w-8 flex-shrink-0 cursor-pointer rounded border border-white/10 bg-transparent p-0"
                                                            title={field.label}
                                                        />
                                                        <span className="min-w-0 truncate font-mono text-[9px] text-white/35">{customThemeColors[field.key]}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs font-bold text-white/75">Тема</div>
                                            <div className="mt-1 text-[11px] text-white/40">Текущая тёмная схема</div>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs font-bold text-white/75">Доступ</div>
                                            <div className="mt-1 text-[11px] text-white/40">{isGM ? 'Полный GM-контроль' : 'Личные настройки игрока'}</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'audio' && (
                            <section className="space-y-3">
                                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <span>
                                        <span className="block text-xs font-bold uppercase tracking-widest text-white/75">Аудио-модуль</span>
                                        <span className="mt-1 block text-[11px] text-white/40">Нижний плеер, пульт звука и приём сессионных audio-команд</span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={audioModuleEnabled}
                                        onChange={(event) => setAudioModuleEnabled(event.target.checked)}
                                        className="h-4 w-4 accent-emerald-300"
                                    />
                                </label>

                                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <span>
                                        <span className="block text-xs font-bold uppercase tracking-widest text-white/75">Звук сессии</span>
                                        <span className="mt-1 block text-[11px] text-white/40">Воспроизведение команд Host/GM на этом клиенте</span>
                                    </span>
                                    <input
                                        type="checkbox"
                                        checked={audioEnabled}
                                        disabled={!audioModuleEnabled}
                                        onChange={(event) => setAudioEnabled(event.target.checked)}
                                        className="h-4 w-4 accent-cyan-300"
                                    />
                                </label>

                                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        <SlidersHorizontal size={14} />
                                        Микшер каналов
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {AUDIO_CHANNELS.map((channel) => (
                                            <label key={channel.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                                                <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold text-white/70">
                                                    <span>{channel.label}</span>
                                                    <span className="font-mono text-white/35">{Math.round(channelVolumes[channel.id] * 100)}</span>
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={channelVolumes[channel.id]}
                                                    disabled={!audioModuleEnabled}
                                                    onChange={(event) => setChannelVolume(channel.id, Number(event.target.value))}
                                                    className="h-1 w-full accent-cyan-300"
                                                />
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'canvas' && (
                            <section className="space-y-3">
                                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        <Grid3X3 size={14} />
                                        Сетка и snap
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={toggleGrid}
                                            className={`h-9 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                                                gridEnabled
                                                    ? 'border-cyan-200/35 bg-cyan-300/15 text-cyan-50'
                                                    : 'border-white/10 bg-black/20 text-white/45 hover:border-white/20 hover:text-white/75'
                                            }`}
                                        >
                                            {gridEnabled ? 'Сетка включена' : 'Сетка выключена'}
                                        </button>
                                        {(['square', 'hex'] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setGridType(type)}
                                                className={`h-9 rounded-lg border px-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                                                    gridType === type
                                                        ? 'border-emerald-200/30 bg-emerald-300/15 text-emerald-50'
                                                        : 'border-white/10 bg-black/20 text-white/45 hover:border-white/20 hover:text-white/75'
                                                }`}
                                            >
                                                {type === 'square' ? 'Квадраты' : 'Гексы'}
                                            </button>
                                        ))}
                                    </div>
                                    <label className="mt-4 block max-w-xs">
                                        <div className="mb-2 flex items-center justify-between text-xs font-bold text-white/65">
                                            <span>Шаг сетки</span>
                                            <span className="font-mono text-white/35">{gridSpacing}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="16"
                                            max="160"
                                            step="2"
                                            value={gridSpacing}
                                            onChange={(event) => setGridSpacing(Number(event.target.value))}
                                            className="h-1 w-full accent-cyan-300"
                                        />
                                    </label>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'world' && isGM && (
                            <section className="space-y-3">
                                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        <Globe2 size={14} />
                                        Мир
                                    </div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs font-bold text-white/75">Комната</div>
                                            <div className="mt-1 truncate text-[11px] text-white/40">{roomName}</div>
                                        </div>
                                        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                                            <div className="text-xs font-bold text-white/75">Хранилище</div>
                                            <div className="mt-1 text-[11px] text-white/40">Файлы мира на Host-диске</div>
                                        </div>
                                    </div>
                                </div>
                            </section>
                        )}

                        {safeActiveTab === 'roles' && isGM && (
                            <section className="space-y-3">
                                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                                        <Shield size={14} />
                                        Роли
                                    </div>
                                    <div className="grid gap-3">
                                        {DEFAULT_ROLE_DEFINITIONS.map((role) => {
                                            const permissions = role.id === 'base-player'
                                                ? role.permissions
                                                : getEffectivePermissions(role.id as UserRole);
                                            return (
                                            <div key={role.id} className="rounded-lg border border-white/10 bg-black/20 p-3">
                                                <div className="mb-2 flex items-center justify-between gap-2">
                                                    <div className="text-xs font-bold text-white/75">{role.label}</div>
                                                    {role.locked && (
                                                        <span className="rounded border border-amber-200/20 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-100/70">
                                                            База
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mb-2 text-[11px] text-white/40">
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
                                                                    ? 'border-emerald-200/20 bg-emerald-300/10 text-emerald-100/65'
                                                                    : 'border-white/10 bg-white/[0.03] text-white/25'
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

                                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/45">
                                            <Users size={14} />
                                            Игроки
                                        </div>
                                        {loadingPlayerProfiles && <Loader2 size={14} className="animate-spin text-white/35" />}
                                    </div>

                                    {playerProfileError && (
                                        <div className="mb-3 rounded-lg border border-red-300/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-100/75">
                                            {playerProfileError}
                                        </div>
                                    )}

                                    <div className="grid gap-2">
                                        {playerProfiles.map((profile) => {
                                            const roleValue = profile.assignedRole === 'gm' ? 'player' : profile.assignedRole;
                                            const isUpdating = updatingPlayerId === profile.playerId;
                                            return (
                                                <div key={profile.playerId} className="flex flex-col gap-3 rounded-lg border border-white/10 bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                                                    <div className="min-w-0">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className="truncate text-xs font-bold text-white/75">{profile.displayName}</span>
                                                            {profile.legacy && (
                                                                <span className="rounded border border-amber-200/20 bg-amber-300/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-100/70">
                                                                    legacy
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="mt-1 truncate font-mono text-[10px] text-white/35">
                                                            {profile.playerId} · users/{profile.storageRoot}
                                                        </div>
                                                        {profile.legacy && (
                                                            <div className="mt-1 text-[10px] text-white/35">
                                                                Профиль появится после входа игрока с этим именем.
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        {isUpdating && <Loader2 size={14} className="animate-spin text-cyan-100/60" />}
                                                        <select
                                                            value={roleValue}
                                                            disabled={profile.legacy || isUpdating}
                                                            onChange={(event) => {
                                                                void handleUpdatePlayerRole(profile, event.target.value as Exclude<UserRole, 'gm'>);
                                                            }}
                                                            className="h-9 rounded-lg border border-white/10 bg-[#111827] px-2 text-xs font-bold text-white/75 outline-none transition-colors hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-45"
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
                                            <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] text-white/40">
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
