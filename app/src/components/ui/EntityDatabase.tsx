import { v4 as uuidv4 } from 'uuid';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { yjsStore } from '../../store/yjsStore';
import { useEntities } from '../../hooks/useEntities';
import { useWindowStore } from '../../store/windowStore';
import { useCanvasStore } from '../../store/canvasStore';
import { DragDropPopover, type DragDropPromptData } from './DragDropPopover';
import { importMarkdown, getIsHost } from '../../services/fileApi';
import { useUIStore } from '../../store/uiStore';
import type { Entity } from '../../types';
import { Edit2, ExternalLink, Download, Trash2, Image as ImageIcon, User, Box, Sword, Wand2, Map, FileText, Bookmark } from 'lucide-react';

const TYPE_ICONS: Record<string, React.FC<any>> = {
    character: User,
    object: Box,
    attack: Sword,
    spell: Wand2,
    canvas: Map,
    note: FileText,
    tag: Bookmark,
    folder: Bookmark,
};

// ─── Custom Context Menu (rendered via React Portal in <body>) ───

interface ContextMenuState {
    x: number;
    y: number;
    entityId: string;
}

function EntityContextMenu({ state, onRename, onOpenWindow, onExport, onDelete, onClose }: {
    state: ContextMenuState | null;
    onRename: (id: string) => void;
    onOpenWindow: (id: string) => void;
    onExport: (id: string) => void;
    onDelete: (id: string) => void;
    onClose: () => void;
}) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!state) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClick);
            document.addEventListener('keydown', handleKey);
        }, 10);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [state, onClose]);

    if (!state) return null;

    const menuWidth = 200;
    const menuHeight = 140;
    const x = state.x + menuWidth > window.innerWidth ? state.x - menuWidth : state.x;
    const y = state.y + menuHeight > window.innerHeight ? state.y - menuHeight : state.y;

    return ReactDOM.createPortal(
        <>
            <div 
                className="fixed inset-0 z-[99998]" 
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                onContextMenu={(e) => { e.preventDefault(); onClose(); }}
            />
            <div
                ref={menuRef}
                className="fixed rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] border border-white/10 py-1.5 min-w-[200px] overflow-hidden backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-100 bg-[#151c2b]/70"
                style={{
                    left: x,
                    top: y,
                    zIndex: 99999,
                }}
            >
            <div className="px-3 py-1.5 text-[9px] font-bold text-white/30 uppercase tracking-widest border-b border-white/5 mb-1 select-none pointer-events-none">
                Контекстное меню
            </div>
            
            <button
                onClick={() => { onRename(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
            >
                <Edit2 size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> Переименовать
            </button>
            <button
                onClick={() => { onOpenWindow(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
            >
                <ExternalLink size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> Открыть окно
            </button>
            <button
                onClick={() => { onExport(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 group"
            >
                <Download size={14} className="text-white/40 group-hover:text-white/80 transition-colors" /> Экспорт .md
            </button>
            <div className="border-t border-white/5 my-1 mx-2" />
            <button
                onClick={() => { onDelete(state.entityId); onClose(); }}
                className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors flex items-center gap-2 group"
            >
                <Trash2 size={14} className="text-red-500/50 group-hover:text-red-400 transition-colors" /> Удалить
            </button>
        </div>
        </>,
        document.body
    );
}

export const EntityGroups = [
    { type: 'canvas', label: 'Пространства', dot: 'bg-orange-400', focus: 'hover:border-orange-400', text: 'text-orange-300', iconHov: 'group-hover:border-orange-400 group-hover:bg-orange-500/10', labelHov: 'group-hover:text-orange-200' },
    { type: 'character', label: 'Персонажи', dot: 'bg-indigo-400', focus: 'hover:border-indigo-400', text: 'text-indigo-300', iconHov: 'group-hover:border-indigo-400 group-hover:bg-indigo-500/10', labelHov: 'group-hover:text-indigo-200' },
    { type: 'object', label: 'Предметы', dot: 'bg-amber-400', focus: 'hover:border-amber-400', text: 'text-amber-300', iconHov: 'group-hover:border-amber-400 group-hover:bg-amber-500/10', labelHov: 'group-hover:text-amber-200' },
    { type: 'ability', label: 'Способности', dot: 'bg-cyan-400', focus: 'hover:border-cyan-400', text: 'text-cyan-300', iconHov: 'group-hover:border-cyan-400 group-hover:bg-cyan-500/10', labelHov: 'group-hover:text-cyan-200' },
    { type: 'note', label: 'Заметки', dot: 'bg-emerald-400', focus: 'hover:border-emerald-400', text: 'text-emerald-300', iconHov: 'group-hover:border-emerald-400 group-hover:bg-emerald-500/10', labelHov: 'group-hover:text-emerald-200' },
    { type: 'tag', label: 'Теги', dot: 'bg-blue-400', focus: 'hover:border-blue-400', text: 'text-blue-300', iconHov: 'group-hover:border-blue-400 group-hover:bg-blue-500/10', labelHov: 'group-hover:text-blue-200' },
    { type: 'attack', label: 'Атаки', dot: 'bg-rose-400', focus: 'hover:border-rose-400', text: 'text-rose-300', iconHov: 'group-hover:border-rose-400 group-hover:bg-rose-500/10', labelHov: 'group-hover:text-rose-200' }
] as const;

interface RecursiveEntityItemProps {
    entity: Entity;
    entities: Entity[];
    level?: number;
    defaultGroupContext?: any;
    baseParentId: string | null;
    targetDb?: import('../../types').DatabaseType;
    onPromptDrop: (data: DragDropPromptData) => void;
    renamingId: string | null;
    onRenameStart: (id: string) => void;
    onRenameSubmit: (id: string, newName: string) => void;
    onRenameCancel: () => void;
    onShowContextMenu: (e: React.MouseEvent, entityId: string) => void;
}

function RecursiveEntityItem({ entity, entities, level = 0, defaultGroupContext, baseParentId, targetDb, onPromptDrop, renamingId, onRenameStart, onRenameSubmit, onRenameCancel, onShowContextMenu }: RecursiveEntityItemProps) {
    const [expanded, setExpanded] = useState(false);
    const [renameValue, setRenameValue] = useState(entity.name);
    const renameInputRef = useRef<HTMLInputElement>(null);
    const { openWindow } = useWindowStore();
    const { navigate } = useCanvasStore();
    const { openConfirm } = useUIStore();

    const isRenaming = renamingId === entity.id;

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onShowContextMenu(e, entity.id);
    };

    const handleRenameSubmitLocal = () => {
        const trimmed = renameValue.trim();
        onRenameSubmit(entity.id, trimmed);
    };

    const handleRenameKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameSubmitLocal();
        if (e.key === 'Escape') onRenameCancel();
    };

    useEffect(() => {
        if (isRenaming) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRenameValue(entity.name);
        }
    }, [isRenaming, entity.name]);

    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    const children = entities.filter(e => e.parentId === entity.id && e.id !== 'root');
    const group = EntityGroups.find(g => g.type === entity.type) || defaultGroupContext || EntityGroups[3];

    let fullUrl = entity.icon_url;
    if (fullUrl && !fullUrl.startsWith('http') && !fullUrl.startsWith('data:')) {
        fullUrl = `http://localhost:3001/api/assets/${fullUrl}`;
    }

    const Icon = TYPE_ICONS[entity.type] || ImageIcon;

    return (
        <div className="flex flex-col gap-1 w-full relative">
            <div
                onClick={() => {
                    if (entity.type === 'character' || entity.type === 'folder') setExpanded(!expanded);
                    else {
                        if (entity.type === 'canvas') navigate(entity.id);
                        else openWindow(entity.id, Math.random() * 200 + 50, Math.random() * 200 + 50);
                    }
                }}
                onDoubleClick={(e) => {
                    if (entity.type === 'character') {
                        e.stopPropagation();
                        openWindow(entity.id, Math.random() * 200 + 50, Math.random() * 200 + 50);
                    }
                }}
                draggable={true}
                onDragStart={(e) => {
                    e.dataTransfer.setData("application/entity-id", entity.id);
                    e.dataTransfer.setData("application/source-database", baseParentId || 'global');
                    e.dataTransfer.setData("text/plain", `[[${entity.name}]]`);
                    e.dataTransfer.effectAllowed = "copyMove";
                }}
                onDragOver={(e) => {
                    if (entity.type === 'folder' || entity.type === 'character') {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                    }
                }}
                onDrop={(e) => {
                    if (entity.type === 'folder' || entity.type === 'character') {
                        e.preventDefault();
                        e.stopPropagation();
                        const draggedId = e.dataTransfer.getData("application/entity-id");
                        const sourceDb = e.dataTransfer.getData("application/source-database");
                        const currentDb = baseParentId || 'global';

                        if (draggedId && draggedId !== entity.id) {
                            const draggedEnt = entities.find(e => e.id === draggedId);
                            if (!draggedEnt || draggedEnt.type === 'canvas') return;

                            // Prevent dragging tags into anything other than folders
                            if (draggedEnt.type === 'tag' && entity.type !== 'folder') return;

                            if (sourceDb === currentDb) {
                                // Same database: just move silently
                                yjsStore.updateEntity(draggedId, { parentId: entity.id });
                                setTimeout(() => setExpanded(true), 50);
                            } else {
                                // Different database: ask user Copy/Move
                                onPromptDrop({
                                    x: e.clientX,
                                    y: e.clientY,
                                    entityName: draggedEnt.name,
                                    onMove: () => {
                                        yjsStore.updateEntity(draggedId, { parentId: entity.id, database: targetDb });
                                    },
                                    onCopy: () => {
                                        yjsStore.cloneEntity(draggedId, entity.id, baseParentId ? (baseParentId.includes('personal-inventory') ? 'user' : 'general') : undefined);
                                    },
                                    onCancel: () => { }
                                });
                            }
                        }
                    }
                }}
                onContextMenu={handleContextMenu}
                className={`p-3 rounded-xl border cursor-pointer transition-all group/item flex items-center justify-between ${group.focus} bg-white/5 border-white/10 hover:bg-white/10 shadow-sm backdrop-blur-md`}
                style={{ marginLeft: level * 12 }}
            >
                <div className="flex items-center gap-3 overflow-hidden flex-1">
                    <div className={`w-8 h-8 overflow-hidden flex-shrink-0 flex items-center justify-center border transition-colors rounded-lg bg-black/20 border-white/10 shadow-inner ${group.text} ${group.iconHov}`}>
                        {fullUrl ? (
                            <img src={fullUrl} alt="" className="w-full h-full object-cover pointer-events-none" />
                        ) : (
                            <Icon size={16} strokeWidth={2} className="opacity-70" />
                        )}
                    </div>
                    <div className="truncate pr-2">
                        {isRenaming ? (
                            <input
                                ref={renameInputRef}
                                value={renameValue}
                                onChange={e => setRenameValue(e.target.value)}
                                onBlur={handleRenameSubmitLocal}
                                onKeyDown={handleRenameKeyDown}
                                onClick={e => e.stopPropagation()}
                                className="bg-black/40 text-white/90 text-sm font-bold px-2 py-0.5 rounded border border-white/20 outline-none w-full"
                            />
                        ) : (
                            <h4 className={`font-bold text-sm transition-colors truncate leading-tight select-none text-white/90 ${group.labelHov}`}>{entity.name}</h4>
                        )}
                        <p className="text-[10px] text-white/40 font-mono mt-0.5 truncate select-none text-left">{entity.type}</p>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            openConfirm({
                                title: "Удаление сущности",
                                description: `Вы уверены, что хотите удалить "${entity.name}"?`,
                                confirmText: "Удалить",
                                isDestructive: true,
                                onConfirm: () => {
                                    yjsStore.deleteEntity(entity.id);
                                    useWindowStore.getState().closeWindow(entity.id);
                                }
                            });
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-2 text-white/30 hover:text-red-400 rounded hover:bg-red-500/20 transition-all ml-1 flex-shrink-0"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                    </button>

                    {(entity.type === 'character' || entity.type === 'folder' || entity.type === 'canvas') && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setExpanded(!expanded);
                            }}
                            className="p-1 text-white/40 hover:text-white"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${expanded ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>
                    )}
                </div>
            </div>

            {
                expanded && (entity.type === 'character' || entity.type === 'folder' || entity.type === 'canvas') && (
                    <div className="flex flex-col gap-1 w-full pl-2 mt-1 relative before:empty before:w-px before:bg-white/10 before:absolute before:left-3 before:top-0 before:bottom-0">
                        {children.length === 0 ? (
                            <div className="text-[10px] text-white/30 italic py-1 pl-4">Пусто</div>
                        ) : (
                            children.map(child => (
                                <RecursiveEntityItem
                                    key={child.id}
                                    entity={child}
                                    entities={entities}
                                    level={level + 1}
                                    defaultGroupContext={entity.type === 'folder' ? group : undefined}
                                    baseParentId={baseParentId}
                                    targetDb={targetDb}
                                    onPromptDrop={onPromptDrop}
                                    renamingId={renamingId}
                                    onRenameStart={onRenameStart}
                                    onRenameSubmit={onRenameSubmit}
                                    onRenameCancel={onRenameCancel}
                                    onShowContextMenu={onShowContextMenu}
                                />
                            ))
                        )}
                    </div>
                )
            }
        </div >
    );
}

interface EntityDatabaseProps {
    baseParentId: string | null;
    showRootCanvas?: boolean;
    headerTitle?: string;
    allowedTabs?: readonly string[];
    targetDb?: import('../../types').DatabaseType;
}

export function EntityDatabase({ baseParentId, showRootCanvas = false, headerTitle = "БАЗА СУЩНОСТЕЙ", allowedTabs, targetDb = 'general' }: EntityDatabaseProps) {
    const entities = useEntities();
    const { openWindow } = useWindowStore();
    const { openConfirm } = useUIStore();
    const [dragDropPrompt, setDragDropPrompt] = useState<DragDropPromptData | null>(null);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [contextMenuState, setContextMenuState] = useState<ContextMenuState | null>(null);
    const importInputRef = useRef<HTMLInputElement>(null);

    // ─── Import .md files ───
    const handleImportFiles = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
            try {
                const content = await file.text();
                const imported = await importMarkdown(content, file.name, targetDb);
                imported.database = targetDb;
                // Add to Yjs so it appears immediately
                yjsStore.addEntity(imported);
                console.log(`📥 Imported: ${imported.name}`);
            } catch (err) {
                console.error(`❌ Failed to import ${file.name}:`, err);
            }
        }

        // Reset file input
        if (importInputRef.current) importInputRef.current.value = '';
    }, [targetDb]);

    // ─── Export entity as .md ───
    const handleExportEntity = useCallback((id: string) => {
        const entity = entities.find(e => e.id === id);
        if (!entity) return;

        // Simple client-side serialization (no server needed)
        const fmLines: string[] = [`type: ${entity.type}`];
        if (entity.tags?.length) fmLines.push(`tags: [${entity.tags.join(', ')}]`);
        if (entity.imageId) fmLines.push(`image: ${entity.imageId}`);
        if (Object.keys(entity.properties || {}).length > 0) {
            fmLines.push(`properties: ${JSON.stringify(entity.properties)}`);
        }

        const md = `---\n${fmLines.join('\n')}\n---\n\n# ${entity.name}\n\n${entity.description || ''}\n`;

        // Trigger download
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${entity.name}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`📤 Exported: ${entity.name}.md`);
    }, [entities]);

    const handleShowContextMenu = useCallback((e: React.MouseEvent, entityId: string) => {
        e.preventDefault();
        setContextMenuState({ x: e.clientX, y: e.clientY, entityId });
    }, []);

    const handleRenameSubmit = useCallback((id: string, newName: string) => {
        if (newName && newName.trim()) {
            const entity = entities.find(e => e.id === id);
            if (entity && newName.trim() !== entity.name) {
                yjsStore.updateEntity(id, { name: newName.trim() });
            }
        }
        setRenamingId(null);
    }, [entities]);

    const handleRenameCancel = useCallback(() => {
        setRenamingId(null);
    }, []);

    const handleRenameStart = useCallback((id: string) => {
        setRenamingId(id);
    }, []);

    const handleCloseContextMenu = useCallback(() => {
        setContextMenuState(null);
    }, []);

    const handlePromptDrop = (data: DragDropPromptData) => {
        setDragDropPrompt({
            ...data,
            onMove: () => { data.onMove(); setDragDropPrompt(null); },
            onCopy: () => { data.onCopy(); setDragDropPrompt(null); },
            onCancel: () => { data.onCancel(); setDragDropPrompt(null); }
        });
    };

    const handleRootDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const draggedId = e.dataTransfer.getData("application/entity-id");
        const sourceDb = e.dataTransfer.getData("application/source-database");
        const currentDb = baseParentId || 'global';

        if (draggedId) {
            const draggedEnt = entities.find(ent => ent.id === draggedId);
            if (!draggedEnt || draggedEnt.type === 'canvas') return;

            // Allow dragging tags to root if we are in the main database ('global') 
            // but restrict adding tags to 'activeCanvasId' or character 'inventory'.
            if (draggedEnt.type === 'tag' && baseParentId !== null && baseParentId !== 'global') {
                return; // Disallow dragging tags to personal inventory or root canvas hierarchy
            }

            if (sourceDb === currentDb) {
                // Moving to the root of the SAME db
                yjsStore.updateEntity(draggedId, { parentId: baseParentId });
            } else {
                // Moving from a DIFFERENT db
                handlePromptDrop({
                    x: e.clientX,
                    y: e.clientY,
                    entityName: draggedEnt.name,
                    onMove: () => yjsStore.updateEntity(draggedId, { parentId: baseParentId, database: targetDb }),
                    onCopy: () => yjsStore.cloneEntity(draggedId, baseParentId, targetDb),
                    onCancel: () => { }
                });
            }
        }
    };

    const addTestEntity = useCallback((type: string, folderType?: string) => {
        const id = uuidv4();
        const base = { id, parentId: baseParentId, type, database: targetDb, name: type, description: '', tags: [], properties: {} };

        if (type === 'character') {
            Object.assign(base, { name: 'character', description: 'Новый персонаж.', properties: { strength: { base: 14 }, dexterity: { base: 12 } }, tags: [] });
        } else if (type === 'object') {
            Object.assign(base, { name: 'object', description: 'Новый предмет.', properties: { фигура: 1, прочность: 1, нагрузка: 1, редкость: 0, цена: 0 } });
        } else if (type === 'attack') {
            Object.assign(base, { name: 'attack', description: 'Новая атака.', properties: { урон: 1, масштаб: 1, попадание: 1, дистанция: 'ближняя' } });
        } else if (type === 'ability') {
            Object.assign(base, { name: 'ability', description: 'Новая способность.', properties: { cost: { base: 0 }, diceFormula: '' } });
        } else if (type === 'tag') {
            Object.assign(base, { name: 'tag', description: 'Новый тег.', properties: { modifiers: [] } });
        } else if (type === 'note') {
            Object.assign(base, { name: 'note', description: '# Новая Заметка' });
        } else if (type === 'canvas') {
            Object.assign(base, { name: 'canvas', description: 'Новое рабочее пространство.', properties: { x: 100, y: 100 } });
        } else if (type === 'folder') {
            Object.assign(base, { name: 'folder', description: 'Папка.', properties: { folderType: folderType || 'tag' } });
        }

        yjsStore.addEntity(base as Entity);
    }, [baseParentId, targetDb]);

    const tabsToShow = EntityGroups.filter(g => !allowedTabs || allowedTabs.includes(g.type));

    return (
        <div className="flex flex-col h-full bg-transparent relative" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={handleRootDrop}>
            {/* Hidden import file input */}
            <input
                ref={importInputRef}
                type="file"
                accept=".md"
                multiple
                className="hidden"
                onChange={handleImportFiles}
            />
            <div className="p-4 border-b border-white/10 bg-black/10 z-10 backdrop-blur-md">
                <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-bold text-white/50 uppercase tracking-widest">{headerTitle}</div>
                    {getIsHost() && (
                        <button
                            onClick={() => importInputRef.current?.click()}
                            className="text-[10px] font-bold text-white/60 hover:text-white/60 bg-white/10 hover:bg-white/10 border border-white/60/40 px-2 py-1 rounded transition-colors flex items-center gap-1"
                            title="Импорт .md файлов"
                        >
                            📥 Импорт .md
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex flex-wrap gap-1 pb-1">
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === 'all' ? 'bg-white/20 text-white shadow-md' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/90'}`}
                    >
                        Все
                    </button>
                    {tabsToShow.map(tab => (
                        <button
                            key={tab.type}
                            onClick={() => setActiveTab(tab.type)}
                            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${activeTab === tab.type ? tab.dot.replace('bg-', 'bg-').replace('500', '600') + ' text-white shadow-md' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/90'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pb-32 custom-scrollbar">
                <div className="flex flex-col gap-2">
                    {showRootCanvas && activeTab === 'all' && (() => {
                        // Create a fake entity object for the root canvas 
                        const rootEntity: import('../../types').Entity = {
                            id: 'root',
                            parentId: null,
                            type: 'canvas',
                            name: 'Корневое пространство',
                            description: '',
                            tags: [],
                            properties: {}
                        };
                        return (
                            <RecursiveEntityItem
                                key="root"
                                entity={rootEntity}
                                entities={entities}
                                defaultGroupContext={EntityGroups.find(g => g.type === 'canvas')!}
                                baseParentId={baseParentId}
                                onPromptDrop={handlePromptDrop}
                                renamingId={renamingId}
                                onRenameStart={handleRenameStart}
                                onRenameSubmit={handleRenameSubmit}
                                onRenameCancel={handleRenameCancel}
                                onShowContextMenu={handleShowContextMenu}
                            />
                        );
                    })()}

                    {tabsToShow.map(group => {
                        if (activeTab !== 'all' && activeTab !== group.type) return null;

                        const groupEntities = entities.filter(e =>
                            e.parentId === baseParentId &&
                            e.id !== 'root' &&
                            (e.type === group.type || (e.type === 'folder' && e.properties?.folderType === group.type))
                        );

                        if (groupEntities.length === 0 && activeTab === 'all') return null;

                        const isCollapsed = collapsedCategories[group.type] || false;

                        return (
                            <div key={group.type} className="mb-4 bg-black/20 rounded-xl border border-white/5 p-2 shadow-inner">
                                <div
                                    className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-white/5 cursor-pointer group hover:bg-white/5 rounded transition-all"
                                    onClick={() => setCollapsedCategories(p => ({ ...p, [group.type]: !isCollapsed }))}
                                >
                                    <h3 className={`text-xs font-bold uppercase tracking-wider border-l-2 pl-2 transition-colors ${group.text}`} style={{ borderLeftColor: 'currentColor' }}>
                                        {group.label} <span className="text-white/30 text-[10px] ml-1">({groupEntities.length})</span>
                                    </h3>
                                    <div className="flex items-center gap-2">
                                        {baseParentId && baseParentId.includes('personal-inventory') && group.type === 'object' && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); addTestEntity('object'); }}
                                                className="text-white/40 hover:text-white p-1 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-white/10"
                                                title="Add Item"
                                            >
                                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); addTestEntity(group.type); }}
                                            className="text-white/40 hover:text-white p-1 rounded transition-colors opacity-0 group-hover:opacity-100 hover:bg-white/10"
                                            title={`Add ${group.label}`}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); addTestEntity('folder', group.type); }}
                                            className="text-white/30 hover:text-white transition-colors flex items-center justify-center p-0.5 rounded hover:bg-white/10 border border-transparent hover:border-white/20"
                                            title="Создать папку"
                                        >
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="9" y1="14" x2="15" y2="14" /></svg>
                                        </button>
                                    </div>
                                </div>

                                {!isCollapsed && (
                                    <div className="flex flex-col gap-1.5">
                                        {groupEntities.length === 0 ? (
                                            <div className="text-[10px] text-white/40 italic px-2 py-4 bg-black/20 rounded-lg border border-white/10 border-dashed text-center">В этой категории пусто</div>
                                        ) : (
                                            groupEntities.map(entity => (
                                                <RecursiveEntityItem
                                                    key={entity.id}
                                                    entity={entity}
                                                    entities={entities}
                                                    defaultGroupContext={group}
                                                    baseParentId={baseParentId}
                                                    onPromptDrop={handlePromptDrop}
                                                    renamingId={renamingId}
                                                    onRenameStart={handleRenameStart}
                                                    onRenameSubmit={handleRenameSubmit}
                                                    onRenameCancel={handleRenameCancel}
                                                    onShowContextMenu={handleShowContextMenu}
                                                />
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <DragDropPopover data={dragDropPrompt} />

            {/* Custom context menu for entity items */}
            <EntityContextMenu
                state={contextMenuState}
                onRename={handleRenameStart}
                onOpenWindow={(id) => openWindow(id, Math.random() * 200 + 50, Math.random() * 200 + 50)}
                onExport={handleExportEntity}
                onDelete={(id) => {
                    const ent = entities.find(e => e.id === id);
                    if (ent) {
                        openConfirm({
                            title: "Удаление сущности",
                            description: `Вы уверены, что хотите удалить "${ent.name}"?`,
                            confirmText: "Удалить",
                            isDestructive: true,
                            onConfirm: () => {
                                yjsStore.deleteEntity(id);
                                useWindowStore.getState().closeWindow(id);
                            }
                        });
                    }
                }}
                onClose={handleCloseContextMenu}
            />
        </div>
    );
}
