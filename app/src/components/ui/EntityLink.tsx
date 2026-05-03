import React from 'react';
import { useEntity, getEntitiesSnapshot } from '../../hooks/useEntities';
import { useWindowStore } from '../../store/windowStore';
import { useCanvasStore } from '../../store/canvasStore';
import { Tooltip } from './Tooltip';
import type { Entity } from '../../types';

interface EntityLinkProps {
    entityName?: string;
    entityId?: string;
    children?: React.ReactNode;
    className?: string;
    underline?: boolean;
}

export const EntityLink: React.FC<EntityLinkProps> = ({ entityName, entityId, children, className = '', underline = true }) => {
    // Use granular selector when we have an ID (most common case)
    const entityById = useEntity(entityId || '');
    const { openWindow } = useWindowStore();

    // Find entity by either ID or Name
    let target: Entity | undefined;
    if (entityId && entityById) {
        target = entityById;
    } else if (entityName) {
        // Name lookup: rare case, use snapshot (non-reactive but avoids subscribing to all entities)
        const all = getEntitiesSnapshot();
        const matches = Object.values(all).filter(ent => ent.name.toLowerCase() === entityName.toLowerCase());
        target = matches.find(ent => ent.parentId === null) || matches[0];
    }

    if (!target) {
        return (
            <span className={`text-red-400 border-b border-dashed border-red-500/50 ${className}`} title={entityName ? `Сущность '${entityName}' не найдена` : 'Сущность не найдена'}>
                {children || entityName || 'Unknown Entity'}
            </span>
        );
    }

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (target) {
            if (target.type === 'canvas') {
                useCanvasStore.getState().navigate(target.id);
            } else {
                openWindow(target.id, e.clientX + 20, e.clientY + 20);
            }
        }
    };

    const tooltipContent = (
        <div className="bg-[#0f111a]/90 backdrop-blur-xl border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] rounded-xl p-3 max-w-xs text-left animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-1.5 border-b border-white/5 pb-2">
                <span className="text-[10px] font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/5 text-emerald-400 uppercase tracking-wider">{target.type}</span>
                <span className="font-bold text-white/90 text-sm truncate pr-2">{target.name}</span>
            </div>
            {target.description ? (
                <p className="text-xs text-white/50 leading-relaxed max-h-32 overflow-hidden text-ellipsis">
                    {target.description}
                </p>
            ) : (
                <p className="text-xs text-white/30 italic mt-2">Нет описания</p>
            )}
        </div>
    );

    const baseClasses = "font-semibold cursor-pointer transition-colors hover:text-white/60 inline-flex items-center gap-1";
    const underlineClasses = underline ? "text-white/60 underline decoration-white/20 decoration-2 underline-offset-2" : "";

    return (
        <Tooltip content={tooltipContent} delay={200} placement="top">
            <span
                onClick={handleClick}
                className={`${baseClasses} ${underlineClasses} ${className}`}
            >
                {children || target.name}
            </span>
        </Tooltip>
    );
};
