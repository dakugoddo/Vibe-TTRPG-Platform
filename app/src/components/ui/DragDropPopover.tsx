import { X, Copy, MoveRight } from 'lucide-react';
import { glass } from '../../utils/theme';

export interface DragDropPromptData {
    x: number;
    y: number;
    entityName: string;
    onMove: () => void;
    onCopy: () => void;
    onCancel: () => void;
}

interface DragDropPopoverProps {
    data: DragDropPromptData | null;
}

export function DragDropPopover({ data }: DragDropPopoverProps) {
    if (!data) return null;

    // Constrain to screen so it doesn't clip
    const w = window.innerWidth;
    const h = window.innerHeight;
    const safeX = Math.min(Math.max(10, data.x), w - 220); // roughly 200px width
    const safeY = Math.min(Math.max(10, data.y), h - 150);

    return (
        <div
            className={`${glass.window} fixed z-[1000] p-3 flex flex-col gap-3 min-w-[200px] animate-in slide-in-from-top-2 fade-in duration-150`}
            style={{ left: safeX, top: safeY }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            <div className="flex justify-between items-start gap-4">
                <span className="text-sm font-bold text-white/90">
                    Действие с "{data.entityName}"
                </span>
                <button onClick={data.onCancel} className="text-white/40 hover:text-white transition-colors">
                    <X size={14} />
                </button>
            </div>

            <div className="flex flex-col gap-2">
                <button
                    onClick={data.onMove}
                    className="flex items-center gap-2 px-3 py-2 bg-white/20 hover:bg-white/60 text-white rounded-lg transition-colors text-xs font-bold w-full text-left shadow-md border border-white/20"
                >
                    <MoveRight size={14} /> Перенести (Move)
                </button>
                <button
                    onClick={data.onCopy}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition-all text-xs font-bold w-full text-left"
                >
                    <Copy size={14} /> Копировать (Copy)
                </button>
            </div>
        </div>
    );
}
