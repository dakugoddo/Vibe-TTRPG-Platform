import { useState } from 'react';
import type { Entity } from '../../../types';
import { yjsStore } from '../../../store/yjsStore';
import { getEntitiesSnapshot } from '../../../hooks/useEntities';
import { useWindowStore } from '../../../store/windowStore';
import { useCalculatedStat, type CalculatedStat } from '../../../hooks/useCalculatedStat';
import { StatTooltip } from '../../ui/StatTooltip';
import { Popover } from '../../ui/Tooltip';
import { EntityLink } from '../../ui/EntityLink';
import { Trash2, Plus, Tag } from 'lucide-react';
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
    properties: any;
    baseLabel?: string;
    adhocLabel?: string;
    handleUpdateAttribute: (p: string[], v: any) => void;
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
    let currentProp = properties;
    for (const p of path) {
        if (!currentProp) break;
        currentProp = currentProp[p];
    }

    const adhoc = currentProp?.adhoc || 0;

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

    const handleUpdateAttribute = (path: string[], value: any) => {
        const newProperties = JSON.parse(JSON.stringify(properties));
        let current = newProperties;
        for (let i = 0; i < path.length - 1; i++) {
            if (!current[path[i]]) current[path[i]] = {};
            current = current[path[i]];
        }
        current[path[path.length - 1]] = value;
        yjsStore.updateEntity(entity.id, { properties: newProperties });
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
                {properties.attributes?.wounds?.current >= limitStat.total * 1.5 && (
                    <div className="absolute inset-0 bg-red-900/10 pointer-events-none animate-pulse"></div>
                )}
                
                <div className="relative z-10 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <h4
                                className="text-[10px] text-white/40 font-bold uppercase tracking-widest mb-1 cursor-pointer hover:text-white transition-colors"
                                onClick={() => handleOpenNote('Раны')}
                            >
                                Состояние Здоровья
                            </h4>
                            <div className="text-white/90 font-bold text-sm">
                                {properties.attributes?.wounds?.current >= limitStat.total ? 'ШОК / КРИТИЧЕСКИ РАНЕН' : 'ЗДОРОВ / ЛЕГКИЕ РАНЫ'}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="text-[10px] text-white/40">
                                Предел:
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
                                        <span className="text-white font-bold ml-1 cursor-pointer hover:text-white/70">{limitStat.total}</span>
                                    </StatTooltip>
                                </Popover>
                            </div>
                            
                            <div className="bg-black/30 rounded-lg px-2 py-0.5 border border-white/5 flex items-center gap-1 shadow-inner backdrop-blur-sm">
                                <input
                                    type="number"
                                    value={properties.attributes?.wounds?.current ?? 0}
                                    onChange={(e) => handleUpdateAttribute(['attributes', 'wounds', 'current'], parseInt(e.target.value) || 0)}
                                    className={clsx("w-8 bg-transparent text-right font-bold text-lg outline-none transition-colors",
                                        properties.attributes?.wounds?.current >= limitStat.total ? "text-red-400" : "text-green-400"
                                    )}
                                    title="Текущие раны"
                                />
                                <span className="text-white/30 text-xs">/</span>
                                <span className="text-white/60 text-xs w-4">{limitStat.total * 2}</span>
                            </div>
                        </div>
                    </div>

                    {/* Horizontal Progress Bar */}
                    <div className="h-3 w-full bg-[#1a1c29] rounded-full overflow-hidden border border-white/5 relative p-[1px] shadow-inner">
                        <div 
                            className={clsx("absolute top-0 left-0 bottom-0 rounded-full transition-all duration-500", 
                                properties.attributes?.wounds?.current >= limitStat.total ? "bg-red-500/80 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : "bg-green-500/80 shadow-[0_0_10px_rgba(74,222,128,0.5)]"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, 100 - ((properties.attributes?.wounds?.current || 0) / (Math.max(1, limitStat.total * 2))) * 100))}%` }}
                        />
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
