import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Copy, MousePointer2, MoveRight, X } from 'lucide-react';

export interface DragDropPromptData {
    x: number;
    y: number;
    entityName: string;
    moveLabel?: string;
    copyLabel?: string;
    canMove?: boolean;
    canCopy?: boolean;
    onMove: () => void;
    onCopy: () => void;
    onCancel: () => void;
}

interface DragDropPopoverProps {
    data: DragDropPromptData | null;
}

export function DragDropPopover({ data }: DragDropPopoverProps) {
    const { t } = useTranslation();
    if (!data) return null;

    const actions = [
        data.canMove !== false ? {
            id: 'move',
            label: data.moveLabel ?? t('dragDrop.move'),
            icon: MoveRight,
            onClick: data.onMove,
            className: 'border-amber-300/25 bg-amber-400/10 text-amber-100 hover:border-amber-200/45 hover:bg-amber-400/20',
        } : null,
        data.canCopy !== false ? {
            id: 'copy',
            label: data.copyLabel ?? t('dragDrop.copy'),
            icon: Copy,
            onClick: data.onCopy,
            className: 'border-cyan-200/20 bg-cyan-300/10 text-cyan-100 hover:border-cyan-200/45 hover:bg-cyan-300/20',
        } : null,
    ].filter((action): action is NonNullable<typeof action> => action !== null);

    if (actions.length === 0 || typeof document === 'undefined') return null;

    const menuWidth = 286;
    const menuHeight = 116 + actions.length * 44;
    const safeX = Math.min(Math.max(12, data.x + 10), Math.max(12, window.innerWidth - menuWidth - 12));
    const safeY = Math.min(Math.max(12, data.y + 10), Math.max(12, window.innerHeight - menuHeight - 12));

    return ReactDOM.createPortal(
        <>
            <div
                className="fixed inset-0 z-[9998]"
                onClick={data.onCancel}
                onContextMenu={(event) => {
                    event.preventDefault();
                    data.onCancel();
                }}
            />

            <div
                className="fixed z-[9999] w-[286px] overflow-hidden rounded-xl border border-white/10 bg-[#101722]/95 shadow-[0_24px_70px_rgba(0,0,0,0.72)] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150"
                style={{ left: safeX, top: safeY }}
                onClick={(event) => event.stopPropagation()}
                onContextMenu={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                }}
                role="menu"
            >
                <div className="flex items-start justify-between gap-3 border-b border-white/10 px-3 py-3">
                    <div className="flex min-w-0 gap-2">
                        <div className="mt-0.5 grid h-8 w-8 flex-shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-cyan-100/70">
                            <MousePointer2 size={15} />
                        </div>
                        <div className="min-w-0">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/35">{t('dragDrop.title')}</div>
                            <div className="truncate text-sm font-bold text-white/90">{data.entityName}</div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={data.onCancel}
                        className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-white/25 hover:text-white"
                        aria-label={t('dragDrop.closeMenu')}
                    >
                        <X size={14} />
                    </button>
                </div>

                <div className="grid gap-2 p-2">
                    {actions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.id}
                                type="button"
                                onClick={action.onClick}
                                className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-xs font-bold transition-all ${action.className}`}
                                role="menuitem"
                            >
                                <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-md bg-white/10">
                                    <Icon size={15} />
                                </span>
                                <span className="min-w-0 truncate">{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>,
        document.body
    );
}
