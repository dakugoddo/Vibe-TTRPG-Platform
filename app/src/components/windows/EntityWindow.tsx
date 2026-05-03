import { Rnd } from 'react-rnd';
import { Minimize2, X, CircleDot, Pin, PinOff, Bug } from 'lucide-react';
import { useWindowStore } from '../../store/windowStore';
import type { WindowState, WindowMode } from '../../store/windowStore';
import { useEntity, getEntitiesSnapshot } from '../../hooks/useEntities';
import { useCanvasStore } from '../../store/canvasStore';
import { CharacterSheet } from './CharacterSheet';
import { yjsStore } from '../../store/yjsStore';
import { Plus, Tag, Trash2, Edit2, Check } from 'lucide-react';
import { MarkdownRenderer } from '../ui/MarkdownRenderer';
import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';

interface ContextMenuState {
    x: number;
    y: number;
}
import { TagEditor } from './blocks/TagEditor';
import { TagPickerPopup } from './blocks/TagPickerPopup';
import { EntityLink } from '../ui/EntityLink';
import { EntityImageBlock } from './blocks/EntityImageBlock';
import { EntityGroups } from '../ui/EntityDatabase';
import { ObjectSheet } from './blocks/ObjectSheet';
import { AttackSheet } from './blocks/AttackSheet';
import { useUIStore } from '../../store/uiStore';
import { glass } from '../../utils/theme';

interface EntityWindowProps {
    windowState: WindowState;
}

export function EntityWindow({ windowState }: EntityWindowProps) {
    const { id, entityId, mode, x, y, width, height, zIndex, isPinned } = windowState;
    const [isEditingDescription, setIsEditingDescription] = useState(false);
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [isTagPickerOpen, setIsTagPickerOpen] = useState(false);

    const entity = useEntity(entityId);
    const { focusWindow, closeWindow, updateWindow, setMode, togglePin, focusedWindowId, openWindow } = useWindowStore();
    const stageScale = useCanvasStore(s => s.scale);
    const stageOffset = useCanvasStore(s => s.offset);
    const activeCanvasId = useCanvasStore(s => s.activeCanvasId);
    const { openConfirm } = useUIStore();

    const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);

    const nameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingName && nameInputRef.current) {
            nameInputRef.current.focus();
            nameInputRef.current.select();
        }
    }, [isEditingName]);

    if (!entity) return null; // Entity deleted while window was open

    const handleModeChange = (newMode: WindowMode) => {
        setMode(id, newMode);
        if (isPinned) {
            yjsStore.updateEntity(entityId, {
                properties: { ...entity.properties, windowState: { ...entity.properties?.windowState, mode: newMode } }
            });
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        setContextMenuState({ x: e.clientX, y: e.clientY });
    };

    const handleRenameSubmit = () => {
        if (tempName.trim() !== '') {
            yjsStore.updateEntity(entityId, { name: tempName });
        }
        setIsEditingName(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameSubmit();
        if (e.key === 'Escape') setIsEditingName(false);
    };

    const handleTitleClick = () => {
        if (entity.type === 'note') return; // Notes don't open themselves

        const allEnts = getEntitiesSnapshot();
        const note = Object.values(allEnts).find(en => en.type === 'note' && en.name.toLowerCase() === entity.name.toLowerCase());
        if (note) {
            openWindow(note.id, x + 50, y + 50);
        }
    };

    const displayX = x;
    const displayY = y;

    const handleDragStop = (_e: any, d: { x: number, y: number }) => {
        const newX = d.x;
        const newY = d.y;
        updateWindow(id, { x: newX, y: newY });
        if (isPinned) {
            yjsStore.updateEntity(entityId, {
                properties: { ...entity.properties, windowState: { ...entity.properties?.windowState, x: newX, y: newY } }
            });
        }
    };

    const handleResizeStop = (_e: any, _direction: any, ref: HTMLElement, _delta: any, position: { x: number, y: number }) => {
        const newX = position.x;
        const newY = position.y;
        const newWidth = parseInt(ref.style.width, 10);
        const newHeight = parseInt(ref.style.height, 10);

        updateWindow(id, {
            width: newWidth,
            height: newHeight,
            x: newX,
            y: newY,
        });
        if (isPinned) {
            yjsStore.updateEntity(entityId, {
                properties: { ...entity.properties, windowState: { ...entity.properties?.windowState, x: newX, y: newY, width: newWidth, height: newHeight } }
            });
        }
    };

    const customRndStyle: React.CSSProperties = {
        zIndex,
        position: 'absolute',
        pointerEvents: 'auto',
    };

    if (mode === 'icon') {
        return (
            <Rnd
                size={{ width: 64, height: 64 }}
                position={{ x: displayX, y: displayY }}
                onDragStop={handleDragStop}
                onMouseDown={() => focusWindow(id)}
                onDoubleClick={() => handleModeChange('compact')}
                enableResizing={false}
                style={customRndStyle}
                scale={isPinned ? stageScale : 1}
            >
                <div className={`w-16 h-16 bg-white/10 border-2 border-white/20 shadow-xl shadow-black/40 flex flex-col items-center justify-center cursor-pointer hover:bg-white/20 backdrop-blur-3xl transition-colors tooltip-trigger relative group ${isPinned ? 'rounded-full' : 'rounded-3xl'}`}>
                    <CircleDot size={20} className="text-white mb-1" />
                    <span className="text-[10px] text-white font-bold truncate w-14 text-center px-1">
                        {entity.name}
                    </span>
                    <div className="absolute top-1/2 left-full ml-2 -translate-y-1/2 bg-black/80 backdrop-blur-md border border-white/20 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg text-white/90">
                        {entity.name}
                    </div>
                </div>
            </Rnd>
        );
    }

    const isFullMode = mode === 'full';
    const group = EntityGroups.find(g => g.type === entity.type);

    const frameClass = `w-full h-full flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${glass.window} ${
        focusedWindowId === id ? '!border-white/30 !shadow-[0_0_40px_rgba(255,255,255,0.05)]' : ''
    } ${isPinned ? 'ring-2 ring-yellow-500/50 outline outline-2 outline-yellow-500/20' : ''}`;

    return (
        <Rnd
            size={isFullMode
                ? { width: Math.max(width, 400), height: Math.max(height, 500) }
                : { width: Math.max(width, 300), height: Math.max(height, 200) }}
            position={{ x: displayX, y: displayY }}
            onDragStop={handleDragStop}
            onResizeStop={handleResizeStop}
            onMouseDown={() => focusWindow(id)}
            minWidth={isFullMode ? 400 : 300}
            minHeight={isFullMode ? 500 : 200}
            style={customRndStyle}
            dragHandleClassName="draggable-header"
            scale={isPinned ? stageScale : 1}
        >
            <div className={frameClass}>
                {/* Header toolbar */}
                <div className={`draggable-header flex items-center justify-between cursor-move select-none relative group ${glass.header} transition-colors p-3 py-2 border-b-2 ${focusedWindowId === id ? 'border-white/30' : 'border-white/5'}`}
                    onContextMenu={handleContextMenu}
                >
                    <div className="flex items-center gap-3 max-w-[60%] overflow-hidden group/title" onClick={handleTitleClick}>
                        {entity.icon_url ? (
                            <img src={entity.icon_url} alt="" className="w-5 h-5 rounded object-cover border border-white/20 select-none pointer-events-none" />
                        ) : (
                            <span className={`w-2.5 h-2.5 rounded flex-shrink-0 relative ${group?.dot || 'bg-white/40'}`}>
                                {isPinned && <span className="absolute -inset-1 rounded bg-yellow-400/30 animate-pulse"></span>}
                            </span>
                        )}
                        {isEditingName ? (
                            <input
                                ref={nameInputRef}
                                type="text"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onBlur={handleRenameSubmit}
                                onKeyDown={handleKeyDown}
                                className={glass.input + " w-full font-bold text-sm px-1 py-0.5 border-white/30"}
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span className={`${glass.titleText} truncate group-hover/title:text-white transition-colors cursor-pointer`}>{entity.name}</span>
                        )}
                        {!isEditingName && (
                            <span className={`text-[10px] font-mono bg-black/30 px-1.5 py-0.5 rounded ml-1 flex-shrink-0 border border-white/5 uppercase tracking-wider ${group?.text || 'text-white/40'}`}>
                                {entity.type}
                            </span>
                        )}
                    </div>

                    {/* Custom context menu rendered via portal at end of file */}

                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                const newIsPinned = !isPinned;

                                // Proper coordinate conversion to prevent UI jumping
                                let newX = x;
                                let newY = y;

                                if (newIsPinned) {
                                    // Screen to Canvas
                                    newX = (x - stageOffset.x) / stageScale;
                                    newY = (y - stageOffset.y) / stageScale;
                                } else {
                                    // Canvas to Screen
                                    newX = (x * stageScale) + stageOffset.x;
                                    newY = (y * stageScale) + stageOffset.y;

                                    // Keep on-screen after unpinning
                                    const wW = window.innerWidth;
                                    const wH = window.innerHeight;
                                    newX = Math.max(10, Math.min(newX, wW - 300));
                                    newY = Math.max(10, Math.min(newY, wH - 100));
                                }

                                togglePin(id, activeCanvasId);
                                updateWindow(id, { x: newX, y: newY, isPinned: newIsPinned, canvasId: newIsPinned ? activeCanvasId : undefined });

                                yjsStore.updateEntity(entityId, {
                                    properties: {
                                        ...entity.properties, windowState: {
                                            ...entity.properties?.windowState,
                                            isPinned: newIsPinned,
                                            canvasId: newIsPinned ? activeCanvasId : undefined,
                                            x: newX, y: newY, width, height, mode, zIndex
                                        }
                                    }
                                });
                            }}
                            className={`p-1.5 rounded transition-all hover:bg-white/10 ${isPinned ? 'text-yellow-400 bg-yellow-400/20' : 'text-white/50'}`}
                            title={isPinned ? 'Unpin from canvas' : 'Pin to canvas'}
                        >
                            {isPinned ? <Pin size={14} /> : <PinOff size={14} />}
                        </button>
                        <div className="w-px h-4 bg-white/20 mx-1"></div>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleModeChange('icon'); }}
                            className="p-1.5 object-cover text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors group-hover:opacity-100"
                            title="Minimize to icon"
                        >
                            <CircleDot size={14} />
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleModeChange(isFullMode ? 'compact' : 'full'); }}
                            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
                            title={isFullMode ? 'Compact Mode' : 'Режим отладки'}
                        >
                            {isFullMode ? <Minimize2 size={14} /> : <Bug size={14} />}
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeWindow(id); }}
                            className="p-1.5 text-white/50 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors ml-1"
                            title="Close window"
                        >
                            <X size={14} />
                        </button>
                    </div>
                </div>

                {/* Content Body */}
                <div className={`flex-1 overflow-y-auto custom-scrollbar flex flex-col p-0`}>
                    {/* The CharacterSheet and generic sheet blocks handle their own padding now to match glass.content if needed. 
                        We wrap them to ensure they use glass.content styling appropriately. */}
                    <div className={`${glass.content} flex-1`}>
                    <EntityImageBlock entity={entity} isWide={entity.type === 'canvas'} />
                    {entity.type === 'character' ? (
                        <CharacterSheet entityId={id} isFullMode={isFullMode} />
                    ) : (
                        <>
                            <div className={glass.blockBg}>
                                <h3 className={glass.blockHeader}>
                                    <div className="flex items-center gap-2 flex-1">
                                        Description
                                    </div>
                                    <button
                                        onClick={() => setIsEditingDescription(!isEditingDescription)}
                                        className={`p-1.5 rounded-lg transition-colors ${isEditingDescription ? 'bg-white/20 text-white shadow-sm' : 'text-white/40 hover:text-white hover:bg-white/10'}`}
                                    >
                                        {isEditingDescription ? <Check size={12} /> : <Edit2 size={12} />}
                                    </button>
                                </h3>

                                {isEditingDescription ? (
                                    <textarea
                                        value={entity.description || ''}
                                        onChange={(e) => yjsStore.updateEntity(entity.id, { description: e.target.value })}
                                        className={`${glass.input} w-full h-32 resize-y flex-1 custom-scrollbar text-sm font-sans`}
                                        placeholder="Type markdown description here..."
                                        autoFocus
                                    />
                                ) : (
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap text-white/80 flex-1 h-full min-h-[100px]" onDoubleClick={() => setIsEditingDescription(true)}>
                                        {entity.description ? <MarkdownRenderer content={entity.description} /> : <span className="text-white/30 italic cursor-pointer">No description provided. Double click to edit.</span>}
                                    </div>
                                )}
                            </div>

                            {entity.type === 'object' && (
                                <ObjectSheet entity={entity} />
                            )}

                            {entity.type === 'attack' && (
                                <AttackSheet entity={entity} />
                            )}

                            {isFullMode && (
                                <div className="space-y-4 animate-in fade-in duration-200 mt-6 slide-in-from-bottom-2">
                                    <div>
                                        <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            Properties
                                            <div className="flex-1 h-px bg-white/10"></div>
                                        </h3>
                                        <div className="bg-black/30 p-3 rounded-xl font-mono text-xs text-green-400 border border-white/5 shadow-inner overflow-x-auto custom-scrollbar">
                                            {Object.keys(entity.properties || {}).length > 0
                                                ? JSON.stringify(entity.properties, null, 2)
                                                : <span className="text-white/30">{"{}"} // No properties recorded</span>}
                                        </div>
                                    </div>

                                    {entity.type === 'tag' && (
                                        <TagEditor entity={entity} />
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2">
                                                <Tag size={12} className="text-white/50" />
                                                TAGS (Скрытые теги)
                                            </h3>
                                            <div className="flex-1 h-px bg-white/10 ml-2"></div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            {entity.tags && entity.tags.length > 0 ? entity.tags.map(tagId => {
                                                const tagEntity = getEntitiesSnapshot()[tagId];
                                                return (
                                                    <div key={tagId} className="group/tag flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden transition-colors hover:border-white/30 backdrop-blur-sm">
                                                        <EntityLink entityId={tagId} underline={false} className="px-2 py-1 text-white/80 font-medium whitespace-nowrap hover:text-white hover:bg-white/5">
                                                            #{tagEntity ? tagEntity.name : 'Unknown Tag'}
                                                        </EntityLink>
                                                        <button
                                                            onClick={() => {
                                                                const newTags = entity.tags.filter(id => id !== tagId);
                                                                yjsStore.updateEntity(entity.id, { tags: newTags });
                                                            }}
                                                            className="px-1.5 py-1 text-white/40 hover:bg-red-500/20 hover:text-red-400 transition-colors border-l border-white/10 group-hover/tag:border-white/30"
                                                            title="Remove Tag"
                                                        >
                                                            <Trash2 size={10} />
                                                        </button>
                                                    </div>
                                                )
                                            }) : <span className="text-white/30 text-xs italic py-1">Нет тегов</span>}

                                            {/* Add tag button */}
                                            <button
                                                className="flex items-center gap-1 px-2 py-1 bg-black/20 border border-white/10 border-dashed rounded-lg text-white/40 hover:text-white hover:border-white/30 hover:bg-white/10 transition-all backdrop-blur-sm"
                                                onClick={() => setIsTagPickerOpen(true)}
                                            >
                                                <Plus size={10} /> Добавить
                                            </button>

                                            <TagPickerPopup
                                                isOpen={isTagPickerOpen}
                                                onClose={() => setIsTagPickerOpen(false)}
                                                onSelect={(tagId) => {
                                                    const newTags = [...(entity.tags || []), tagId];
                                                    yjsStore.updateEntity(entity.id, { tags: newTags });
                                                }}
                                                excludeTags={entity.tags || []}
                                                allowedFolders={['folder_tags_hidden']}
                                                title="Прикрепить (Скрытые теги)"
                                            />
                                        </div>
                                    </div>

                                    <div className="text-xs text-white/30 pt-4 mt-auto border-t border-white/10 flex justify-between items-center">
                                        <span>System ID:</span>
                                        <span className="font-mono text-[10px] bg-black/30 px-2 py-1 rounded-md truncate max-w-[200px] border border-white/5 shadow-inner select-all">{entity.id}</span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    </div>
                </div>
            </div>
            {contextMenuState && ReactDOM.createPortal(
                <>
                    <div 
                        className="fixed inset-0 z-[99998]" 
                        onClick={(e) => { e.stopPropagation(); setContextMenuState(null); }}
                        onContextMenu={(e) => { e.preventDefault(); setContextMenuState(null); }}
                    />
                    <div
                        className="fixed rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 py-1.5 min-w-[200px] overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-100 bg-[#151c2b]/70"
                        style={{
                            left: contextMenuState.x + 200 > window.innerWidth ? contextMenuState.x - 200 : contextMenuState.x,
                            top: contextMenuState.y + 100 > window.innerHeight ? contextMenuState.y - 100 : contextMenuState.y,
                            zIndex: 99999,
                        }}
                    >
                        <div className="px-3 py-1.5 text-[9px] font-bold text-white/30 uppercase tracking-widest border-b border-white/5 mb-1 select-none pointer-events-none">
                            Контекстное меню
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setTempName(entity.name); setIsEditingName(true); setContextMenuState(null); }}
                            className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
                        >
                            <Edit2 size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> Переименовать
                        </button>
                        <div className="border-t border-white/5 my-1 mx-2" />
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setContextMenuState(null);
                                openConfirm({
                                    title: "Удаление сущности",
                                    description: `Вы уверены, что хотите удалить "${entity.name}"?`,
                                    confirmText: "Удалить",
                                    isDestructive: true,
                                    onConfirm: () => {
                                        yjsStore.deleteEntity(entityId);
                                        closeWindow(id);
                                    }
                                });
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center gap-2 group"
                        >
                            <Trash2 size={14} className="text-red-500/50 group-hover:text-red-400 transition-colors" /> Удалить сущность
                        </button>
                    </div>
                </>,
                document.body
            )}
        </Rnd >
    );
}
