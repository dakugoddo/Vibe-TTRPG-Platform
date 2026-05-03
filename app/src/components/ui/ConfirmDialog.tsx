import { useUIStore } from '../../store/uiStore';
import { AlertTriangle } from 'lucide-react';
import { glass } from '../../utils/theme';

export function ConfirmDialog() {
    const { confirmDialog, closeConfirm } = useUIStore();

    if (!confirmDialog) return null;

    const handleConfirm = () => {
        confirmDialog.onConfirm();
        closeConfirm();
    };

    const handleCancel = () => {
        if (confirmDialog.onCancel) {
            confirmDialog.onCancel();
        }
        closeConfirm();
    };

    return (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={handleCancel}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            <div
                className={`${glass.window} w-full max-w-sm rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150`}
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-start gap-4 p-5">
                    <div className={`p-2 rounded-full flex-shrink-0 border ${confirmDialog.isDestructive ? 'bg-red-500/20 text-red-400 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-white/20 text-white/60 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]'}`}>
                        <AlertTriangle size={24} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white/90">{confirmDialog.title}</h3>
                        <p className="text-sm text-white/60 mt-1">{confirmDialog.description}</p>
                    </div>
                </div>

                <div className="bg-black/40 px-5 py-4 flex justify-end gap-3 border-t border-white/10">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 text-sm font-bold text-white/70 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-colors outline-none"
                    >
                        {confirmDialog.cancelText || 'Отмена'}
                    </button>
                    <button
                        onClick={handleConfirm}
                        className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-all outline-none border ${confirmDialog.isDestructive ? 'bg-red-500/80 hover:bg-red-500 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-white/20 hover:bg-white/60 border-white/20 shadow-[0_0_15px_rgba(255,255,255,0.1)]'}`}
                    >
                        {confirmDialog.confirmText || 'Удалить'}
                    </button>
                </div>
            </div>
        </div>
    );
}
