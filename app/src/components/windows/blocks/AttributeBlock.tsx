import { useState } from 'react';
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

const StatRow = ({
    entityId,
    path,
    label,
    icon: Icon,
    properties,
    baseLabel,
    adhocLabel,
    handleUpdateAttribute
}: {
    entityId: string;
    path: string[];
    label: string;
    icon?: React.ElementType;
    properties: Record<string, unknown>;
    baseLabel?: string;
    adhocLabel?: string;
    handleUpdateAttribute: (p: string[], v: unknown) => void;
}) => {
    const stat = useCalculatedStat(entityId, path);
    const allEntities = getEntitiesSnapshot();
    const { openWindow } = useWindowStore();

    const handleOpenNote = (noteName: string) => {
        const note = Object.values(allEntities).find(en => en.type === 'note' && en.name === noteName);
        if (note) {
            openWindow(note.id, Math.random() * 200 + 100, Math.random() * 200 + 100);
        } else {
            console.log(`Заметка '${noteName}' не найдена`);
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
        <div className="flex flex-col items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10 transition-all group relative shadow-sm">
            <div className="flex items-center gap-1 mb-2">
                {Icon && <Icon size={12} className="text-white/30 group-hover:text-white/60 transition-colors" />}
                <span
                    className="text-[10px] text-white/40 uppercase tracking-widest font-bold cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleOpenNote(label)}
                >
                    {label}
                </span>
            </div>
            <Popover
                placement="left"
                content={
                    <div className="p-3 bg-[#151c2b]/70 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-3">
                        <span className="text-xs text-white/50 uppercase tracking-widest font-bold border-b border-white/10 pb-2">Редак.: {label}</span>

                        <div className="flex gap-4">
                            <div className="flex flex-col gap-1 w-16">
                                <label className="text-[10px] text-white/50 whitespace-nowrap">{baseLabel || 'База'}</label>
                                <input
                                    type="number"
                                    value={stat.base}
                                    onChange={(e) => handleUpdateAttribute([...path, 'base'], parseInt(e.target.value) || 0)}
                                    className={`${glass.input} text-center`}
                                />
                            </div>

                            <div className="flex flex-col gap-1 w-16">
                                <label className="text-[10px] text-white/50 whitespace-nowrap">{adhocLabel || 'Доп.'}</label>
                                <input
                                    type="number"
                                    value={adhoc}
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
                        stat.total > stat.base ? "text-green-400 group-hover:text-green-300" :
                            stat.total < stat.base ? "text-red-400 group-hover:text-red-300" :
                                "text-white/90 group-hover:text-white"
                    )}>
                        {stat.total}
                    </div>
                </StatTooltip>
            </Popover>
        </div>
    );
};

export function AttributeBlock({ entity }: AttributeBlockProps) {
    const properties = entity.properties || {};
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
            console.log(`Заметка '${noteName}' не найдена`);
        }
    };

    // Calculate final stats based on tags and base values
    const limitStat = useCalculatedStat(entity.id, ['attributes', 'wounds', 'limit']);
    const woundsAdhoc = properties.attributes?.wounds?.limit?.adhoc || 0;
    const currentWounds = Number(properties.attributes?.wounds?.current ?? 0);
    const maxWounds = Math.max(0, limitStat.total * 2);

    // Specific calculation for Мощь (Power)
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
            { source: 'Мощь', value: Math.floor(activePowerTotal / 2) }
        ]
    };

    const handleUpdateAttribute = (path: string[], value: unknown) => {
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
        const newValue = Math.max(0, Math.min(maxWounds, value));
        if (newValue === currentWounds) return;

        handleUpdateAttribute(['attributes', 'wounds', 'current'], newValue);

        // Log to chat
        const actualDelta = newValue - currentWounds;
        const emoji = actualDelta > 0 ? '⚔️' : '💚';
        const sign = actualDelta > 0 ? '+' : '';
        yjsStore.sendMessage(
            `${emoji} ${entity.name}: ${sign}${actualDelta} ран (текущие: ${newValue}/${maxWounds})`,
            'Система',
            true
        );
    };

    const handleChangeWounds = (delta: number) => {
        setWoundsValue(currentWounds + delta);
    };

    const startWoundsEdit = () => {
        setWoundsDraft(String(currentWounds));
        setIsEditingWounds(true);
    };

    const commitWoundsDraft = () => {
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
                    <div className="absolute inset-0 bg-red-900/10 pointer-events-none animate-pulse"></div>
                )}
                
                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <h4
                                    className="text-[10px] text-white/40 font-bold uppercase tracking-widest cursor-pointer hover:text-white transition-colors"
                                    onClick={() => handleOpenNote('Раны')}
                                >
                                    Состояние Здоровья
                                </h4>
                                <Popover
                                    placement="bottom"
                                    content={
                                        <div className="p-3 bg-[#151c2b]/70 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-3">
                                            <span className="text-xs text-white/50 uppercase tracking-widest font-bold border-b border-white/10 pb-2">Предел ран</span>
                                            <div className="flex gap-4">
                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="text-[10px] text-white/50 whitespace-nowrap">База</label>
                                                    <input
                                                        type="number"
                                                        value={limitStat.base}
                                                        onChange={(e) => handleUpdateAttribute(['attributes', 'wounds', 'limit', 'base'], parseInt(e.target.value) || 1)}
                                                        className={`${glass.input} text-center`}
                                                    />
                                                </div>
                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="text-[10px] text-white/50 whitespace-nowrap">Доп.</label>
                                                    <input
                                                        type="number"
                                                        value={woundsAdhoc}
                                                        onChange={(e) => handleUpdateAttribute(['attributes', 'wounds', 'limit', 'adhoc'], parseInt(e.target.value) || 0)}
                                                        className={`${glass.input} text-center`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <StatTooltip stat={limitStat}>
                                        <span className="text-[10px] text-white/30 cursor-pointer hover:text-white/60 transition-colors">
                                            Предел: <span className="text-white font-bold">{limitStat.total}</span>
                                        </span>
                                    </StatTooltip>
                                </Popover>
                            </div>
                            <div className="text-white/90 font-bold text-sm">
                                {currentWounds >= limitStat.total ? 'ШОК / КРИТИЧЕСКИ РАНЕН' : 'ЗДОРОВ / ЛЕГКИЕ РАНЫ'}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Interactive wound controls */}
                            <div className="flex items-center gap-1 bg-black/30 rounded-lg px-1.5 py-1 border border-white/5 shadow-inner backdrop-blur-sm">
                                <button
                                    onClick={() => handleChangeWounds(-5)}
                                    disabled={currentWounds <= 0}
                                    className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    title="−5 ран"
                                >
                                    <Minus size={10} />
                                    <span className="text-[8px]">5</span>
                                </button>
                                <button
                                    onClick={() => handleChangeWounds(-1)}
                                    disabled={currentWounds <= 0}
                                    className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    title="−1 рана"
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
                                            currentWounds >= limitStat.total ? "text-red-300" : "text-green-300"
                                        )}
                                        title="Enter — сохранить, Esc — отменить"
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        className={clsx(
                                            "h-8 w-12 text-center font-bold text-xl tabular-nums select-none transition-colors rounded-md hover:bg-white/10 hover:brightness-125",
                                            currentWounds >= limitStat.total ? "text-red-400" : "text-green-400"
                                        )}
                                        title="Нажать — ввести вручную"
                                        onClick={startWoundsEdit}
                                    >
                                        {currentWounds}
                                    </button>
                                )}

                                <button
                                    onClick={() => handleChangeWounds(1)}
                                    disabled={currentWounds >= maxWounds}
                                    className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    title="+1 рана"
                                >
                                    <Plus size={14} />
                                </button>
                                <button
                                    onClick={() => handleChangeWounds(5)}
                                    disabled={currentWounds >= maxWounds}
                                    className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                                    title="+5 ран"
                                >
                                    <Plus size={10} />
                                    <span className="text-[8px]">5</span>
                                </button>
                            </div>

                            <span className="text-white/30 text-xs">/</span>
                            <span className="text-white/60 text-xs w-4">{maxWounds}</span>
                        </div>
                    </div>

            {/* Horizontal Progress Bar — clickable */}
            <div
                className="h-3 w-full bg-[#1a1c29] rounded-full overflow-hidden border border-white/5 relative p-[1px] shadow-inner cursor-pointer group/bar"
                onClick={() => handleChangeWounds(1)}
                onContextMenu={(e) => { e.preventDefault(); handleChangeWounds(-1); }}
                title="ЛКМ: +1 рана | ПКМ: −1 рана"
            >
                <div
                    className={clsx("absolute top-0 left-0 bottom-0 rounded-full transition-all duration-300",
                        currentWounds >= limitStat.total ? "bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-green-500/80 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                    )}
                    style={{ width: `${Math.min(100, Math.max(0, (currentWounds / Math.max(1, maxWounds)) * 100))}%` }}
                />
                {/* Hover hint */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/bar:opacity-100 transition-opacity">
                    <span className="text-[9px] text-white/60 font-bold drop-shadow-lg">ЛКМ +1 / ПКМ −1</span>
                </div>
            </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* ATTRIBUTES BLOCK */}
                <div className={`${glass.blockBg} col-span-2 lg:col-span-1`}>
                    <h4
                        className={glass.blockHeader + " cursor-pointer hover:text-white"}
                        onClick={() => handleOpenNote('Атрибуты')}
                    >
                        Атрибуты
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                        <StatRow entityId={entity.id} path={['attributes', 'constitution']} label="Телосложение" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                        <StatRow entityId={entity.id} path={['attributes', 'cognition']} label="Когниция" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                        <StatRow entityId={entity.id} path={['attributes', 'physique']} label="Фигура" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                        <StatRow entityId={entity.id} path={['attributes', 'mind']} label="Мышление" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                        <StatRow entityId={entity.id} path={['attributes', 'speed']} label="Скорость" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                        <StatRow entityId={entity.id} path={['attributes', 'hunger']} label="Голод" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                    </div>
                </div>

                <div className="col-span-2 lg:col-span-1 flex flex-col gap-4">
                    {/* POWER BLOCK */}
                    <div className={`${glass.blockBg} flex-1`}>
                        <div className="flex items-center justify-between mb-4">
                            <h4
                                className={glass.blockHeader + " mb-0 cursor-pointer hover:text-white"}
                                onClick={() => handleOpenNote('Мощь')}
                            >
                                Мощь
                            </h4>
                            <div className="px-3 py-1 bg-white/10 rounded font-bold font-mono text-sm shadow-inner text-white/90">
                                {activePowerTotal}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <StatRow entityId={entity.id} path={['power', 'astral']} label="Астрал" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                            <StatRow entityId={entity.id} path={['power', 'ether']} label="Эфир" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                            <StatRow entityId={entity.id} path={['power', 'aura']} label="Аура" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                        </div>

                        <div className="pt-3 border-t border-white/10">
                            <label className="text-[10px] text-white/40 uppercase font-bold tracking-wider mb-2 block">Активированные источники</label>
                            <div className="flex bg-black/30 p-1 rounded-xl border border-white/5 gap-1 shadow-inner backdrop-blur-md">
                                <button
                                    onClick={() => togglePower('astral')}
                                    className={clsx("flex-1 text-xs py-1.5 rounded-lg transition-all duration-300 font-medium", activePowers.includes('astral') ? "bg-white/15 text-white shadow-md border border-white/10 backdrop-blur-xl" : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent")}
                                >Астрал</button>
                                <button
                                    onClick={() => togglePower('ether')}
                                    className={clsx("flex-1 text-xs py-1.5 rounded-lg transition-all duration-300 font-medium", activePowers.includes('ether') ? "bg-white/15 text-white shadow-md border border-white/10 backdrop-blur-xl" : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent")}
                                >Эфир</button>
                                <button
                                    onClick={() => togglePower('aura')}
                                    className={clsx("flex-1 text-xs py-1.5 rounded-lg transition-all duration-300 font-medium", activePowers.includes('aura') ? "bg-white/15 text-white shadow-md border border-white/10 backdrop-blur-xl" : "text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent")}
                                >Аура</button>
                            </div>
                        </div>
                    </div>

                    {/* DEFENSE BLOCK */}
                    <div className={`${glass.blockBg}`}>
                        <h4
                            className={glass.blockHeader + " cursor-pointer hover:text-white"}
                            onClick={() => handleOpenNote('Защита')}
                        >
                            Защита
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                            {/* Custom Evasion Row to use the overridden stat */}
                            <div className="flex flex-col items-center justify-between p-3 rounded-xl bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10 transition-all group relative shadow-sm">
                                <div className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-2 cursor-pointer hover:text-white transition-colors" onClick={() => handleOpenNote('Уклонение')}>
                                    Уклонение
                                </div>
                                <Popover
                                    placement="left"
                                    content={
                                        <div className="p-3 bg-[#151c2b]/70 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col gap-3">
                                            <span className="text-xs text-white/50 uppercase tracking-widest font-bold border-b border-white/10 pb-2">Редак.: Уклонение</span>

                                            <div className="flex gap-4">
                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="text-[10px] text-white/50 whitespace-nowrap">База</label>
                                                    <input
                                                        type="number"
                                                        value={baseEvasionStat.base}
                                                        onChange={(e) => handleUpdateAttribute(['defense', 'evasion', 'base'], parseInt(e.target.value) || 0)}
                                                        className={`${glass.input} text-center font-mono`}
                                                    />
                                                </div>

                                                <div className="flex flex-col gap-1 w-16">
                                                    <label className="text-[10px] text-white/50 whitespace-nowrap">Доп.</label>
                                                    <input
                                                        type="number"
                                                        value={properties.defense?.evasion?.adhoc || 0}
                                                        onChange={(e) => handleUpdateAttribute(['defense', 'evasion', 'adhoc'], parseInt(e.target.value) || 0)}
                                                        className={`${glass.input} text-center font-mono`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <StatTooltip stat={evasionFullStat}>
                                        <div className="text-xl font-bold cursor-pointer transition-colors p-1 text-white/90 group-hover:text-white">
                                            {evasionFullStat.total}
                                        </div>
                                    </StatTooltip>
                                </Popover>
                            </div>

                            <StatRow entityId={entity.id} path={['defense', 'armor']} label="Броня" properties={properties} handleUpdateAttribute={handleUpdateAttribute} />
                        </div>
                    </div>
                </div>
            </div>

            {/* STATUSES BLOCK */}
            <div className={`${glass.blockBg}`}>
                <div className="flex items-center justify-between mb-4">
                    <h4 className={glass.blockHeader + " mb-0"}>
                        <Tag size={14} className="mr-2" />
                        Статусы и Состояния
                    </h4>

                    <button
                        className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/10 border-dashed rounded-md text-white/50 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all text-[10px] font-bold uppercase tracking-wider"
                        onClick={() => setIsTagPickerOpen(true)}
                    >
                        <Plus size={12} /> Добавить
                    </button>

                    <TagPickerPopup
                        isOpen={isTagPickerOpen}
                        onClose={() => setIsTagPickerOpen(false)}
                        onSelect={(tagId) => {
                            const newTags = [...(entity.tags || []), tagId];
                            yjsStore.updateEntity(entity.id, { tags: newTags });
                            // Log to chat
                            const tagEntity = getEntitiesSnapshot()[tagId];
                            if (tagEntity) {
                                yjsStore.sendMessage(
                                    `🏷️ ${entity.name}: +${tagEntity.name}`,
                                    'Система',
                                    true
                                );
                            }
                        }}
                        excludeTags={entity.tags || []}
                        allowedFolders={['folder_tags_statuses']}
                        title="Добавить статус"
                    />
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                    {entity.tags && entity.tags.length > 0 ? entity.tags.map(tagId => {
                        const tagEntity = getEntitiesSnapshot()[tagId];

                        // Check if it's actually placed in the statuses folder (optional, but good for filtering general tags visually if needed)
                        if (tagEntity && tagEntity.parentId !== 'folder_tags_statuses') return null; // Only show statuses here

                        return (
                            <div key={tagId} className="group/tag flex items-center bg-[#2e3145] border border-white/5 rounded-lg overflow-hidden transition-colors hover:border-white/30 shadow-md">
                                <EntityLink entityId={tagId} underline={false} className="px-2 py-1 text-white/80 font-medium whitespace-nowrap hover:text-white text-xs" />
                                <button
                                    onClick={() => {
                                        const newTags = entity.tags.filter(id => id !== tagId);
                                        yjsStore.updateEntity(entity.id, { tags: newTags });
                                        // Log to chat
                                        if (tagEntity) {
                                            yjsStore.sendMessage(
                                                `🏷️ ${entity.name}: −${tagEntity.name}`,
                                                'Система',
                                                true
                                            );
                                        }
                                    }}
                                    className="px-2 py-1 text-white/30 hover:bg-red-900/40 hover:text-red-400 transition-colors border-l border-white/10 group-hover/tag:border-white/20"
                                    title="Убрать"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        )
                    }) : <span className="text-gray-500 text-xs italic">Нет активных статусов</span>}
                </div>
            </div>

        </div>
    );
}
