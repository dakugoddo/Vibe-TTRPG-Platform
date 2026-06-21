import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { getEntitiesSnapshot } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { useCalculatedStat, type CalculatedStat } from '../../../hooks/useCalculatedStat';
import { StatTooltip } from '../../ui/StatTooltip';
import { Popover } from '../../ui/Tooltip';
import { EntityLink } from '../../ui/EntityLink';
import { Trash2, Plus, Minus, Tag } from 'lucide-react';
import clsx from 'clsx';
import { TagPickerPopup } from './TagPickerPopup';
import { glass } from '../../../utils/theme';

interface AttributeBlockProps {
    entity: Entity;
}

function getEntityOwnerId(entity: Entity): string | undefined {
    const owner = entity.properties?._playerOwner;
    return typeof owner === 'string' ? owner : undefined;
}

const StatRow = ({
    entityId,
    path,
    label,
    noteName,
    icon: Icon,
    properties,
    baseLabel,
    adhocLabel,
    handleUpdateAttribute,
    canEdit
}: {
    entityId: string;
    path: string[];
    label: string;
    noteName?: string;
    icon?: React.ElementType;
    properties: Record<string, unknown>;
    baseLabel?: string;
    adhocLabel?: string;
    handleUpdateAttribute: (p: string[], v: unknown) => void;
    canEdit: boolean;
}) => {
    const { t } = useTranslation();
    const stat = useCalculatedStat(entityId, path);
    const allEntities = getEntitiesSnapshot();
    const { openWindow } = useWindowStore();

    const handleOpenNote = (noteName: string) => {
        const note = Object.values(allEntities).find(en => en.type === 'note' && en.name === noteName);
        if (note) {
            openWindow(note.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
        } else {
            console.log(t('attackSheet.noteNotFound', { name: noteName }));
        }
    };

    // Navigate to get the current object
    let currentProp: unknown = properties;
    for (const p of path) {
        if (!currentProp || typeof currentProp !== 'object') break;
        currentProp = (currentProp as Record<string, unknown>)[p];
    }

    const adhoc = currentProp && typeof currentProp === 'object'
        ? Number((currentProp as Record<string, unknown>).adhoc ?? 0)
        : 0;

    return (
        <div className="group relative flex flex-col items-center justify-between rounded-[var(--vibe-radius-md)] border border-transparent bg-[var(--vibe-surface-input)] p-3 shadow-sm transition-all hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)]">
            <div className="flex items-center gap-1 mb-2">
                {Icon && <Icon size={12} className="text-[var(--vibe-text-faint)] transition-colors group-hover:text-[var(--vibe-text-muted)]" />}
                <span
                    className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)] transition-colors hover:text-[var(--vibe-text-primary)]"
                    onClick={() => handleOpenNote(noteName ?? label)}
                >
                    {label}
                </span>
            </div>
            <Popover
                placement="left"
                content={
                    <div className={`flex flex-col gap-3 rounded-[var(--vibe-radius-md)] p-3 ${glass.popover}`}>
                        <span className="border-b border-[var(--vibe-border-subtle)] pb-2 text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">{t('attributeBlock.editLabel', { label })}</span>

                        <div className="flex gap-4">
                            <div className="flex flex-col gap-1 w-16">
                                <label className="whitespace-nowrap text-[10px] text-[var(--vibe-text-muted)]">{baseLabel || t('statTooltip.base')}</label>
                                <input
                                    type="number"
                                    value={stat.base}
                                    readOnly={!canEdit}
                                    onChange={(e) => handleUpdateAttribute([...path, 'base'], parseInt(e.target.value) || 0)}
                                    className={`${glass.input} text-center`}
                                />
                            </div>

                            <div className="flex flex-col gap-1 w-16">
                                <label className="whitespace-nowrap text-[10px] text-[var(--vibe-text-muted)]">{adhocLabel || t('attributeBlock.adhocShort')}</label>
                                <input
                                    type="number"
                                    value={adhoc}
                                    readOnly={!canEdit}
                                    onChange={(e) => handleUpdateAttribute([...path, 'adhoc'], parseInt(e.target.value) || 0)}
                                    className={`${glass.input}`}
                                />
                            </div>
                        </div>
                    </div>
                }
            >
                <StatTooltip stat={stat}>
                    <div className={clsx(
                        "text-xl font-bold cursor-pointer transition-colors p-1",
                        stat.total > stat.base ? "text-[var(--vibe-success)] group-hover:brightness-125" :
                            stat.total < stat.base ? "text-[var(--vibe-danger)] group-hover:brightness-125" :
                                "text-[var(--vibe-text-primary)]"
                    )}>
                        {stat.total}
                    </div>
                </StatTooltip>
            </Popover>
        </div>
    );
};

export function AttributeBlock({ entity }: AttributeBlockProps) {
    const { t } = useTranslation();
    const properties = entity.properties || {};
    const canEditAttributes = yjsStore.canModify(entity.database, getEntityOwnerId(entity));
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);
    const [isEditingWounds, setIsEditingWounds] = useState(false);
    const [woundsDraft, setWoundsDraft] = useState('');
    const { openWindow } = useWindowStore();

    // Helper to open note by name
    const handleOpenNote = (noteName: string) => {
        const all = getEntitiesSnapshot();
        const note = Object.values(all).find(en => en.type === 'note' && en.name.toLowerCase() === noteName.toLowerCase());
        if (note) {
            // Random offset for window
            openWindow(note.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
        } else {
            console.log(t('attackSheet.noteNotFound', { name: noteName }));
        }
    };

    // Calculate final stats based on tags and base values
    const limitStat = useCalculatedStat(entity.id, ['attributes', 'wounds', 'limit']);
    const woundsAdhoc = properties.attributes?.wounds?.limit?.adhoc || 0;
    const currentWounds = Number(properties.attributes?.wounds?.current ?? 0);
    const maxWounds = Math.max(0, limitStat.total * 2);

    // Specific calculation for Power.
    const activePowers: string[] = properties.activePowers || []; // 'astral', 'ether', 'aura'
    const astral = useCalculatedStat(entity.id, ['power', 'astral']).total;
    const ether = useCalculatedStat(entity.id, ['power', 'ether']).total;
    const aura = useCalculatedStat(entity.id, ['power', 'aura']).total;

    // Sum calculation for multiple active powers
    let activePowerTotal = 0;
    if (activePowers.includes('astral')) activePowerTotal += Math.max(0, astral);
    if (activePowers.includes('ether')) activePowerTotal += Math.max(0, ether);
    if (activePowers.includes('aura')) activePowerTotal += Math.max(0, aura);

    // Evasion logic (uses floor(activePowerTotal / 2))
    const baseEvasionStat = useCalculatedStat(entity.id, ['defense', 'evasion']);
    const evasionTotal = baseEvasionStat.total + Math.floor(activePowerTotal / 2);
    // Reconstruct the stat object to include the dynamically calculated power mod
    const evasionFullStat: CalculatedStat = {
        base: baseEvasionStat.base,
        total: evasionTotal,
        breakdown: [
            ...baseEvasionStat.breakdown,
            { source: t('attributeBlock.power.title'), value: Math.floor(activePowerTotal / 2) }
        ]
    };

    const handleUpdateAttribute = (path: string[], value: unknown) => {
        if (!canEditAttributes) return;
        const newProperties = JSON.parse(JSON.stringify(properties));
        let current = newProperties;
        for (let i = 0; i < path.length - 1; i++) {
            if (!current[path[i]]) current[path[i]] = {};
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
        yjsStore.updateEntity(entity.id, { properties: newProperties });
    };

    const setWoundsValue = (value: number) => {
        if (!canEditAttributes) return;
        const newValue = Math.max(0, Math.min(maxWounds, value));
        if (newValue === currentWounds) return;

        handleUpdateAttribute(['attributes', 'wounds', 'current'], newValue);

        // Log to chat
        const actualDelta = newValue - currentWounds;
        const emoji = actualDelta > 0 ? '⚔️' : '💚';
        const sign = actualDelta > 0 ? '+' : '';
        yjsStore.sendMessage(
            t('attributeBlock.wounds.chatDelta', { emoji, name: entity.name, sign, delta: actualDelta, current: newValue, max: maxWounds }),
            t('chat.systemSender'),
            true
        );
    };

    const handleChangeWounds = (delta: number) => {
        setWoundsValue(currentWounds + delta);
    };

    const startWoundsEdit = () => {
        if (!canEditAttributes) return;
        setWoundsDraft(String(currentWounds));
        setIsEditingWounds(true);
    };

    const commitWoundsDraft = () => {
        if (!canEditAttributes) {
            setIsEditingWounds(false);
            return;
        }
        const trimmed = woundsDraft.trim();
        if (trimmed === '') {
            setWoundsDraft(String(currentWounds));
            setIsEditingWounds(false);
            return;
        }

        const nextValue = Number.parseInt(trimmed, 10);
        if (Number.isFinite(nextValue)) {
            setWoundsValue(nextValue);
        }

        setWoundsDraft(String(Math.max(0, Math.min(maxWounds, Number.isFinite(nextValue) ? nextValue : currentWounds))));
        setIsEditingWounds(false);
    };

    const togglePower = (power: string) => {
        if (!canEditAttributes) return;
        const currentPowers: string[] = properties.activePowers || [];
        if (currentPowers.includes(power)) {
            handleUpdateAttribute(['activePowers'], currentPowers.filter(p => p !== power));
        } else {
            handleUpdateAttribute(['activePowers'], [...currentPowers, power]);
        }
    };

    return (
        <div className="space-y-4">
            {/* WOUNDS BLOCK */}
            <div className={`${glass.blockBg} overflow-hidden relative group/wounds`}>
                {currentWounds >= limitStat.total * 1.5 && (
                    <div className="pointer-events-none absolute inset-0 animate-pulse bg-[color-mix(in_srgb,var(--vibe-danger)_10%,transparent)]"></div>
                )}
                
                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h4
                                    className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)] transition-colors hover:text-[var(--vibe-text-primary)]"
                                    onClick={() => handleOpenNote('Раны')}
                                >
                                    {t('attributeBlock.wounds.title')}
                                </h4>
                                <Popover
                                    placement="bottom"
                                    content={
                                        <div className={`flex flex-col gap-3 rounded-[var(--vibe-radius-md)] p-3 ${glass.popover}`}>
                                            <span className="border-b border-[var(--vibe-border-subtle)] pb-2 text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">{t('attributeBlock.wounds.limit')}</span>
                                            <div className="flex gap-4">
                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="whitespace-nowrap text-[10px] text-[var(--vibe-text-muted)]">{t('statTooltip.base')}</label>
                                                    <input
                                                        type="number"
                                                        value={limitStat.base}
                                                        readOnly={!canEditAttributes}
                                                        onChange={(e) => handleUpdateAttribute(['attributes', 'wounds', 'limit', 'base'], parseInt(e.target.value) || 1)}
                                                        className={`${glass.input} text-center`}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="whitespace-nowrap text-[10px] text-[var(--vibe-text-muted)]">{t('attributeBlock.adhocShort')}</label>
                                                    <input
                                                        type="number"
                                                        value={woundsAdhoc}
                                                        readOnly={!canEditAttributes}
                                                        onChange={(e) => handleUpdateAttribute(['attributes', 'wounds', 'limit', 'adhoc'], parseInt(e.target.value) || 0)}
                                                        className={`${glass.input} text-center`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <StatTooltip stat={limitStat}>
                                        <span className="cursor-pointer text-[10px] text-[var(--vibe-text-faint)] transition-colors hover:text-[var(--vibe-text-muted)]">
                                            {t('attributeBlock.wounds.limitPrefix')} <span className="font-bold text-[var(--vibe-text-primary)]">{limitStat.total}</span>
                                        </span>
                                    </StatTooltip>
                                </Popover>
                            </div>
                            <div className="text-sm font-bold text-[var(--vibe-text-primary)]">
                                {currentWounds >= limitStat.total ? t('attributeBlock.wounds.critical') : t('attributeBlock.wounds.healthy')}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Interactive wound controls */}
                            <div className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-1.5 py-1 shadow-[var(--vibe-shadow-block)]">
                                <button
                                    onClick={() => handleChangeWounds(-5)}
                                    disabled={!canEditAttributes || currentWounds <= 0}
                                    className="rounded p-1 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                    title={t('attributeBlock.wounds.minus', { count: 5 })}
                                >
                                    <Minus size={10} />
                                    <span className="text-[8px]">5</span>
                                </button>
                                <button
                                    onClick={() => handleChangeWounds(-1)}
                                    disabled={!canEditAttributes || currentWounds <= 0}
                                    className="rounded p-1 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                    title={t('attributeBlock.wounds.minus', { count: 1 })}
                                >
                                    <Minus size={14} />
                                </button>

                                {isEditingWounds ? (
                                    <input
                                        autoFocus
                                        type="number"
                                        min={0}
                                        max={maxWounds}
                                        value={woundsDraft}
                                        readOnly={!canEditAttributes}
                                        onChange={(e) => setWoundsDraft(e.target.value)}
                                        onBlur={commitWoundsDraft}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                e.currentTarget.blur();
                                            }
                                            if (e.key === 'Escape') {
                                                e.preventDefault();
                                                setWoundsDraft(String(currentWounds));
                                                setIsEditingWounds(false);
                                            }
                                        }}
                                        className={clsx(
                                            glass.input,
                                            "h-8 w-12 px-1 py-0 text-center text-lg font-bold tabular-nums",
                                            currentWounds >= limitStat.total ? "text-[var(--vibe-danger)]" : "text-[var(--vibe-success)]"
                                        )}
                                        title={t('attributeBlock.wounds.editKeys')}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        disabled={!canEditAttributes}
                                        className={clsx(
                                            "h-8 w-12 select-none rounded-[var(--vibe-radius-sm)] text-center text-xl font-bold tabular-nums transition-colors hover:bg-[var(--vibe-surface-hover)] hover:brightness-125",
                                            currentWounds >= limitStat.total ? "text-[var(--vibe-danger)]" : "text-[var(--vibe-success)]"
                                        )}
                                        title={t('attributeBlock.wounds.manualInput')}
                                        onClick={startWoundsEdit}
                                    >
                                        {currentWounds}
                                    </button>
                                )}

                                <button
                                    onClick={() => handleChangeWounds(1)}
                                    disabled={!canEditAttributes || currentWounds >= maxWounds}
                                    className="rounded p-1 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                    title={t('attributeBlock.wounds.plus', { count: 1 })}
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    onClick={() => handleChangeWounds(5)}
                                    disabled={!canEditAttributes || currentWounds >= maxWounds}
                                    className="rounded p-1 text-[var(--vibe-text-faint)] transition-all hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)] disabled:cursor-not-allowed disabled:opacity-20"
                                    title={t('attributeBlock.wounds.plus', { count: 5 })}
                                >
                                    <Plus size={10} />
                                    <span className="text-[8px]">5</span>
                                </button>
                            </div>

                            <span className="text-xs text-[var(--vibe-text-faint)]">/</span>
                            <span className="w-4 text-xs text-[var(--vibe-text-muted)]">{maxWounds}</span>
                        </div>
                    </div>

            {/* Horizontal Progress Bar — clickable */}
            <div
                className="group/bar relative h-3 w-full cursor-pointer overflow-hidden rounded-full border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] p-[1px] shadow-[var(--vibe-shadow-block)]"
                onClick={() => { if (canEditAttributes) handleChangeWounds(1); }}
                onContextMenu={(e) => { e.preventDefault(); if (canEditAttributes) handleChangeWounds(-1); }}
                title={t('attributeBlock.wounds.barTitle')}
            >
                <div
                    className={clsx("absolute top-0 left-0 bottom-0 rounded-full transition-all duration-300",
                        currentWounds >= limitStat.total
                            ? "bg-[var(--vibe-danger)] shadow-[0_0_10px_color-mix(in_srgb,var(--vibe-danger)_45%,transparent)]"
                            : "bg-[var(--vibe-success)] shadow-[0_0_10px_color-mix(in_srgb,var(--vibe-success)_45%,transparent)]"
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, (currentWounds / Math.max(1, maxWounds)) * 100))}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity">
                    <span className="text-[9px] font-bold text-[var(--vibe-text-muted)] drop-shadow-lg">{t('attributeBlock.wounds.barHint')}</span>
                </div>
            </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className={`${glass.blockBg} col-span-2 lg:col-span-1`}>
                    <h4
                        className={glass.blockHeader + " cursor-pointer hover:text-[var(--vibe-text-primary)]"}
                        onClick={() => handleOpenNote('Атрибуты')}
                    >
                        {t('attributeBlock.attributes.title')}
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <StatRow entityId={entity.id} path={['attributes', 'constitution']} label={t('markdownRenderer.stats.defaults.constitution')} noteName="Телосложение" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                        <StatRow entityId={entity.id} path={['attributes', 'cognition']} label={t('markdownRenderer.stats.defaults.cognition')} noteName="Когниция" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                        <StatRow entityId={entity.id} path={['attributes', 'physique']} label={t('markdownRenderer.stats.defaults.physique')} noteName="Фигура" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                        <StatRow entityId={entity.id} path={['attributes', 'mind']} label={t('markdownRenderer.stats.defaults.mind')} noteName="Мышление" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                        <StatRow entityId={entity.id} path={['attributes', 'speed']} label={t('markdownRenderer.stats.defaults.speed')} noteName="Скорость" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                        <StatRow entityId={entity.id} path={['attributes', 'hunger']} label={t('markdownRenderer.stats.defaults.hunger')} noteName="Голод" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                    </div>
                </div>

                <div className="col-span-2 lg:col-span-1 flex flex-col gap-4">
                    <div className={`${glass.blockBg} flex-1`}>
                        <div className="flex items-center justify-between mb-4">
                            <h4
                                className={glass.blockHeader + " mb-0 cursor-pointer hover:text-[var(--vibe-text-primary)]"}
                                onClick={() => handleOpenNote('Мощь')}
                            >
                                {t('attributeBlock.power.title')}
                            </h4>
                            <div className="rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-3 py-1 font-mono text-sm font-bold text-[var(--vibe-text-primary)] shadow-[var(--vibe-shadow-block)]">
                                {activePowerTotal}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <StatRow entityId={entity.id} path={['power', 'astral']} label={t('markdownRenderer.stats.defaults.astral')} noteName="Астрал" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                            <StatRow entityId={entity.id} path={['power', 'ether']} label={t('markdownRenderer.stats.defaults.ether')} noteName="Эфир" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                            <StatRow entityId={entity.id} path={['power', 'aura']} label={t('markdownRenderer.stats.defaults.aura')} noteName="Аура" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                        </div>

                        <div className="border-t border-[var(--vibe-border-subtle)] pt-3">
                            <label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)]">{t('attributeBlock.power.activeSources')}</label>
                            <div className={`${glass.tabBar} flex gap-1 rounded-[var(--vibe-radius-md)] p-1`}>
                                <button
                                    onClick={() => togglePower('astral')}
                                    disabled={!canEditAttributes}
                                    className={clsx("flex-1 rounded-[var(--vibe-radius-sm)] border py-1.5 text-xs font-medium transition-all duration-300", activePowers.includes('astral') ? glass.tabActive : glass.tabIdle)}
                                >{t('markdownRenderer.stats.defaults.astral')}</button>
                                <button
                                    onClick={() => togglePower('ether')}
                                    disabled={!canEditAttributes}
                                    className={clsx("flex-1 rounded-[var(--vibe-radius-sm)] border py-1.5 text-xs font-medium transition-all duration-300", activePowers.includes('ether') ? glass.tabActive : glass.tabIdle)}
                                >{t('markdownRenderer.stats.defaults.ether')}</button>
                                <button
                                    onClick={() => togglePower('aura')}
                                    disabled={!canEditAttributes}
                                    className={clsx("flex-1 rounded-[var(--vibe-radius-sm)] border py-1.5 text-xs font-medium transition-all duration-300", activePowers.includes('aura') ? glass.tabActive : glass.tabIdle)}
                                >{t('markdownRenderer.stats.defaults.aura')}</button>
                            </div>
                        </div>
                    </div>

                    <div className={`${glass.blockBg}`}>
                        <h4
                            className={glass.blockHeader + " cursor-pointer hover:text-[var(--vibe-text-primary)]"}
                            onClick={() => handleOpenNote('Защита')}
                        >
                            {t('attributeBlock.defense.title')}
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="group relative flex flex-col items-center justify-between rounded-[var(--vibe-radius-md)] border border-transparent bg-[var(--vibe-surface-input)] p-3 shadow-sm transition-all hover:border-[var(--vibe-border-subtle)] hover:bg-[var(--vibe-surface-hover)]">
                                <div className="mb-2 cursor-pointer text-[10px] font-bold uppercase tracking-widest text-[var(--vibe-text-faint)] transition-colors hover:text-[var(--vibe-text-primary)]" onClick={() => handleOpenNote('Уклонение')}>
                                    {t('markdownRenderer.stats.defaults.evasion')}
                                </div>
                                <Popover
                                    placement="left"
                                    content={
                                        <div className={`flex flex-col gap-3 rounded-[var(--vibe-radius-md)] p-3 ${glass.popover}`}>
                                            <span className="border-b border-[var(--vibe-border-subtle)] pb-2 text-xs font-bold uppercase tracking-widest text-[var(--vibe-text-faint)]">{t('attributeBlock.editLabel', { label: t('markdownRenderer.stats.defaults.evasion') })}</span>

                                            <div className="flex gap-4">
                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="whitespace-nowrap text-[10px] text-[var(--vibe-text-muted)]">{t('statTooltip.base')}</label>
                                                    <input
                                                        type="number"
                                                        value={baseEvasionStat.base}
                                                        readOnly={!canEditAttributes}
                                                        onChange={(e) => handleUpdateAttribute(['defense', 'evasion', 'base'], parseInt(e.target.value) || 0)}
                                                        className={`${glass.input} text-center font-mono`}
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="whitespace-nowrap text-[10px] text-[var(--vibe-text-muted)]">{t('attributeBlock.adhocShort')}</label>
                                                    <input
                                                        type="number"
                                                        value={properties.defense?.evasion?.adhoc || 0}
                                                        readOnly={!canEditAttributes}
                                                        onChange={(e) => handleUpdateAttribute(['defense', 'evasion', 'adhoc'], parseInt(e.target.value) || 0)}
                                                        className={`${glass.input} text-center font-mono`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <StatTooltip stat={evasionFullStat}>
                                        <div className="cursor-pointer p-1 text-xl font-bold text-[var(--vibe-text-primary)] transition-colors">
                                            {evasionFullStat.total}
                                        </div>
                                    </StatTooltip>
                                </Popover>
                            </div>

                            <StatRow entityId={entity.id} path={['defense', 'armor']} label={t('markdownRenderer.stats.defaults.armor')} noteName="Броня" properties={properties} handleUpdateAttribute={handleUpdateAttribute} canEdit={canEditAttributes} />
                        </div>
                    </div>
                </div>
            </div>

            <div className={`${glass.blockBg}`}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className={glass.blockHeader + " mb-0"}>
                        <Tag size={14} className="mr-2" />
                        {t('attributeBlock.statuses.title')}
                    </h4>

                    {canEditAttributes && (
                        <>
                            <button
                                className="flex items-center gap-1 rounded-[var(--vibe-radius-sm)] border border-dashed border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--vibe-text-faint)] transition-all hover:border-[var(--vibe-border-strong)] hover:bg-[var(--vibe-surface-hover)] hover:text-[var(--vibe-text-primary)]"
                                onClick={() => setIsTagPickerOpen(true)}
                            >
                                <Plus size={12} /> {t('attributeBlock.statuses.add')}
                            </button>

                            <TagPickerPopup
                                isOpen={isTagPickerOpen}
                                onClose={() => setIsTagPickerOpen(false)}
                                onSelect={(tagId) => {
                                    if (!canEditAttributes) return;
                                    const newTags = [...(entity.tags || []), tagId];
                                    yjsStore.updateEntity(entity.id, { tags: newTags });
                                    // Log to chat
                                    const tagEntity = getEntitiesSnapshot()[tagId];
                                    if (tagEntity) {
                                        yjsStore.sendMessage(
                                            `🏷️ ${entity.name}: +${tagEntity.name}`,
                                            t('chat.systemSender'),
                                            true
                                        );
                                    }
                                }}
                                excludeTags={entity.tags || []}
                                allowedFolders={['folder_tags_statuses']}
                                title={t('attributeBlock.statuses.addStatus')}
                            />
                        </>
                    )}
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                    {entity.tags && entity.tags.length > 0 ? entity.tags.map(tagId => {
                        const tagEntity = getEntitiesSnapshot()[tagId];

                        // Check if it's actually placed in the statuses folder (optional, but good for filtering general tags visually if needed)
                        if (tagEntity && tagEntity.parentId !== 'folder_tags_statuses') return null; // Only show statuses here

                        return (
                            <div key={tagId} className="group/tag flex items-center overflow-hidden rounded-[var(--vibe-radius-sm)] border border-[var(--vibe-border-subtle)] bg-[var(--vibe-surface-input)] shadow-[var(--vibe-shadow-block)] transition-colors hover:border-[var(--vibe-border-strong)]">
                                <EntityLink entityId={tagId} underline={false} className="whitespace-nowrap px-2 py-1 text-xs font-medium text-[var(--vibe-text-muted)] hover:text-[var(--vibe-text-primary)]" />
                                {canEditAttributes && (
                                    <button
                                        onClick={() => {
                                            if (!canEditAttributes) return;
                                            const newTags = entity.tags.filter(id => id !== tagId);
                                            yjsStore.updateEntity(entity.id, { tags: newTags });
                                            // Log to chat
                                            if (tagEntity) {
                                                yjsStore.sendMessage(
                                                    `🏷️ ${entity.name}: −${tagEntity.name}`,
                                                    t('chat.systemSender'),
                                                    true
                                                );
                                            }
                                        }}
                                        className="border-l border-[var(--vibe-border-subtle)] px-2 py-1 text-[var(--vibe-text-faint)] transition-colors hover:bg-[color-mix(in_srgb,var(--vibe-danger)_18%,transparent)] hover:text-[var(--vibe-danger)] group-hover/tag:border-[var(--vibe-border-strong)]"
                                        title={t('propertiesBlock.remove')}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>
                        )
                    }) : <span className="text-xs italic text-[var(--vibe-text-faint)]">{t('attributeBlock.statuses.empty')}</span>}
                </div>
            </div>

        </div>
    );
}
