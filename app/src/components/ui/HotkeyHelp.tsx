import { useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import { HelpCircle, X, MousePointer2, Pencil, Minus, Square, Disc, MessageSquare, Type, Image, Hand, Grid3X3, type LucideIcon } from 'lucide-react';

interface ShortcutItem {
    keys: string[];
    desc: string;
    icon?: LucideIcon;
}

interface ShortcutSection {
    section: string;
    items: ShortcutItem[];
}

export function HotkeyHelp() {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const shortcuts: ShortcutSection[] = [
        { section: t('hotkeys.sections.canvasTools'), items: [
            { keys: ['H'], desc: t('hotkeys.items.hand'), icon: Hand },
            { keys: ['V'], desc: t('hotkeys.items.select'), icon: MousePointer2 },
            { keys: ['P'], desc: t('hotkeys.items.pen'), icon: Pencil },
            { keys: ['L'], desc: t('hotkeys.items.line'), icon: Minus },
            { keys: ['R'], desc: t('hotkeys.items.rectangle'), icon: Square },
            { keys: ['O'], desc: t('hotkeys.items.ellipse'), icon: Disc },
            { keys: ['F'], desc: t('hotkeys.items.frame'), icon: MessageSquare },
            { keys: ['T'], desc: t('hotkeys.items.text'), icon: Type },
            { keys: ['I'], desc: t('hotkeys.items.image'), icon: Image },
            { keys: ['1-9'], desc: t('hotkeys.items.tools'), icon: Grid3X3 },
        ]},
        { section: t('hotkeys.sections.editing'), items: [
            { keys: ['Ctrl+Z'], desc: t('hotkeys.items.undo') },
            { keys: ['Ctrl+Shift+Z', 'Ctrl+Y'], desc: t('hotkeys.items.redo') },
            { keys: ['Ctrl+C'], desc: t('hotkeys.items.copy') },
            { keys: ['Ctrl+V'], desc: t('hotkeys.items.paste') },
            { keys: ['Delete', 'Backspace'], desc: t('hotkeys.items.deleteConfirm') },
            { keys: ['Ctrl+A'], desc: t('hotkeys.items.selectAll') },
            { keys: ['Esc'], desc: t('hotkeys.items.clearSelection') },
        ]},
        { section: t('hotkeys.sections.navigation'), items: [
            { keys: [t('hotkeys.keys.mouseWheel')], desc: t('hotkeys.items.zoom') },
            { keys: [t('hotkeys.keys.middleDrag')], desc: t('hotkeys.items.pan') },
            { keys: ['Shift + drag'], desc: t('hotkeys.items.axisMove') },
        ]},
        { section: t('hotkeys.sections.multiplayer'), items: [
            { keys: [t('hotkeys.keys.gClick')], desc: t('hotkeys.items.ping') },
            { keys: [t('hotkeys.keys.portalContext')], desc: t('hotkeys.items.portalContext') },
        ]},
        { section: t('hotkeys.sections.chatDice'), items: [
            { keys: ['/r 2d6'], desc: t('hotkeys.items.roll2d6') },
            { keys: ['/r 1d20+5'], desc: t('hotkeys.items.rollModifier') },
            { keys: ['Enter'], desc: t('hotkeys.items.sendMessage') },
            { keys: [t('hotkeys.keys.fogPanel')], desc: t('hotkeys.items.fogEdit') },
        ]},
        { section: t('hotkeys.sections.windows'), items: [
            { keys: [t('hotkeys.keys.doubleIcon')], desc: t('hotkeys.items.expandWindow') },
            { keys: [t('hotkeys.keys.doubleDatabase')], desc: t('hotkeys.items.openWindow') },
            { keys: [t('hotkeys.keys.pinButton')], desc: t('hotkeys.items.pinWindow') },
        ]},
    ];

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-30 w-10 h-10 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 hover:border-white/30 transition-all shadow-lg"
                title={t('hotkeys.title')}
            >
                <HelpCircle size={18} />
            </button>
        );
    }

    return ReactDOM.createPortal(
        <>
            <div
                className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
                onClick={() => setIsOpen(false)}
            />
            <div className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none p-4">
                <div className="pointer-events-auto bg-[#151c2b]/95 backdrop-blur-3xl border border-white/10 rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.7)] w-full max-w-[520px] max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-white/10">
                        <div>
                            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                <HelpCircle size={16} className="text-violet-400" />
                                {t('hotkeys.title')}
                            </h3>
                            <p className="text-xs text-white/40 mt-0.5">{t('hotkeys.subtitle')}</p>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4">
                        {shortcuts.map((section) => (
                            <div key={section.section}>
                                <h4 className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2 border-b border-white/5 pb-1.5">
                                    {section.section}
                                </h4>
                                <div className="space-y-1">
                                    {section.items.map((item, idx) => {
                                        const Icon = item.icon;
                                        return (
                                            <div
                                                key={idx}
                                                className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors group"
                                            >
                                                <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors flex items-center gap-2">
                                                    {Icon && <Icon size={12} className="text-white/30" />}
                                                    {item.desc}
                                                </span>
                                                <div className="flex gap-1">
                                                    {item.keys.map((key, ki) => (
                                                        <kbd
                                                            key={ki}
                                                            className="px-2 py-0.5 text-[10px] font-mono font-bold bg-black/40 text-white/70 border border-white/10 rounded-md shadow-inner"
                                                        >
                                                            {key}
                                                        </kbd>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
