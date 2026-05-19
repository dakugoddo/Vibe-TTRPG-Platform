import { useState } from 'react';
import ReactDOM from 'react-dom';
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

const SHORTCUTS: ShortcutSection[] = [
    { section: 'Инструменты канваса', items: [
        { keys: ['H'], desc: 'Hand (панорама)', icon: Hand },
        { keys: ['V'], desc: 'Select (выделение)', icon: MousePointer2 },
        { keys: ['P'], desc: 'Pen (карандаш)', icon: Pencil },
        { keys: ['L'], desc: 'Line (линия)', icon: Minus },
        { keys: ['R'], desc: 'Rectangle', icon: Square },
        { keys: ['O'], desc: 'Ellipse (овал)', icon: Disc },
        { keys: ['F'], desc: 'Frame (фрейм)', icon: MessageSquare },
        { keys: ['T'], desc: 'Text (текст)', icon: Type },
        { keys: ['I'], desc: 'Image (изображение)', icon: Image },
        { keys: ['1-9'], desc: 'Инструменты 1-9', icon: Grid3X3 },
    ]},
    { section: 'Редактирование', items: [
        { keys: ['Ctrl+Z'], desc: 'Отменить' },
        { keys: ['Ctrl+Shift+Z', 'Ctrl+Y'], desc: 'Повторить' },
        { keys: ['Ctrl+C'], desc: 'Копировать' },
        { keys: ['Ctrl+V'], desc: 'Вставить' },
        { keys: ['Delete', 'Backspace'], desc: 'Удалить (с подтверждением)' },
        { keys: ['Ctrl+A'], desc: 'Выделить всё' },
        { keys: ['Esc'], desc: 'Снять выделение / Выйти из Fog режима' },
    ]},
    { section: 'Навигация', items: [
        { keys: ['Колёсико мыши'], desc: 'Zoom' },
        { keys: ['Средняя кнопка + drag'], desc: 'Панорама' },
        { keys: ['Shift + drag'], desc: 'Движение по одной оси' },
    ]},
    { section: 'Мультиплеер', items: [
        { keys: ['G + клик'], desc: 'Пинг на канвасе' },
        { keys: ['ПКМ на портале'], desc: 'Контекстное меню портала' },
    ]},
    { section: 'Чат и кубы', items: [
        { keys: ['/r 2d6'], desc: 'Бросок 2d6' },
        { keys: ['/r 1d20+5'], desc: 'Бросок с модификатором' },
        { keys: ['Enter'], desc: 'Отправить сообщение' },
        { keys: ['👁️ (панель)'], desc: 'Режим редактирования тумана войны' },
    ]},
    { section: 'Окна', items: [
        { keys: ['Двойной клик (иконка)'], desc: 'Развернуть окно' },
        { keys: ['Двойной клик (база)'], desc: 'Открыть персонажа в окне' },
        { keys: ['📌 (кнопка)'], desc: 'Закрепить окно на канвасе' },
    ]},
];

export function HotkeyHelp() {
    const [isOpen, setIsOpen] = useState(false);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 z-30 w-10 h-10 rounded-xl bg-white/10 border border-white/20 backdrop-blur-md flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 hover:border-white/30 transition-all shadow-lg"
                title="Горячие клавиши"
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
                                Горячие клавиши
                            </h3>
                            <p className="text-xs text-white/40 mt-0.5">Все сочетания клавиш и управления</p>
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
                        {SHORTCUTS.map((section) => (
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
