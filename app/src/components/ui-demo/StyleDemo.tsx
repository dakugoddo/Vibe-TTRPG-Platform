import { useState } from 'react';
import { Settings, Shield, Sword, X, Minimize2, Backpack, Sparkles, Sparkle, Wind, Ghost, Box, Grid, List as ListIcon } from 'lucide-react';

// Common visual classes for the Glassmorphism base style
const glass = {
    bg: 'bg-gradient-to-br from-[#1b1b2f] via-[#2a2a40] to-[#1a173d]',
    window: 'bg-white/5 backdrop-blur-3xl border border-white/10 shadow-[0_15px_50px_rgba(0,0,0,0.5)] rounded-2xl',
    header: 'bg-white/5 border-b border-white/10 p-4 rounded-t-2xl',
    titleText: 'text-white/90 font-medium tracking-tight',
    content: 'p-6 flex flex-col gap-6',
    blockBg: 'bg-black/20 border border-white/5 rounded-xl p-4 shadow-inner',
    blockHeader: 'text-[10px] text-white/50 font-bold uppercase tracking-widest mb-4 flex justify-between items-center',
    input: 'bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white outline-none focus:bg-white/10 focus:border-white/20 transition-all font-mono',
};

// Layout Variants
const VARIANTS = [
    { id: 'v1', name: 'Вариант А: Компактные списки', desc: 'Классические бары и плотные списки. Хорошо для информации.' },
    { id: 'v2', name: 'Вариант Б: Карточный вид', desc: 'Визуальные карточки инвентаря, сегментированные раны.' },
    { id: 'v3', name: 'Вариант В: Подробный / Радиальный', desc: 'Шкалы, круглые индикаторы, больше акцента на числах.' }
];

export function StyleDemo({ onClose }: { onClose: () => void }) {
    const [selectedVariant, setSelectedVariant] = useState(VARIANTS[0].id);
    const [activeTab, setActiveTab] = useState('stats');

    return (
        <div className={`fixed inset-0 z-[10000] flex flex-col w-full h-full overflow-hidden ${glass.bg} transition-all duration-500 font-sans`}>
            
            {/* Header Toolbar */}
            <div className="flex-shrink-0 bg-black/40 backdrop-blur-xl border-b border-white/10 p-4 flex items-center justify-between z-10 relative shadow-2xl">
                <div className="flex items-center gap-4 pr-6">
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Sparkles className="text-blue-400" />
                        Варианты Раскладки Окна
                    </h1>
                </div>
                
                <div className="flex bg-black/50 p-1.5 rounded-xl border border-white/5 shadow-inner flex-1 max-w-2xl mx-6 justify-center gap-2">
                    {VARIANTS.map(variant => (
                        <button
                            key={variant.id}
                            onClick={() => setSelectedVariant(variant.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex-1 ${selectedVariant === variant.id ? 'bg-white/60/50 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] backdrop-blur-md border border-white/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {variant.name.split(':')[1] || variant.name}
                        </button>
                    ))}
                </div>

                <div>
                    <button onClick={onClose} className="p-2.5 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500 hover:text-white transition-colors border border-red-500/20">
                        <X size={20} />
                    </button>
                </div>
            </div>

            {/* Main Stage */}
            <div className="flex-1 overflow-y-auto w-full flex items-start justify-center p-8 pb-32 custom-scrollbar">
                
                <div className={`w-[950px] flex flex-col ${glass.window} transition-all duration-300 relative`}>
                    
                    {/* Window Header */}
                    <div className={`${glass.header} flex items-center justify-between`}>
                        <div className="flex items-center gap-3">
                            <Shield className="text-white/60" size={18} />
                            <span className={glass.titleText}>Артур (Паладин)</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-white/30 cursor-pointer"><Minimize2 size={16} /></span>
                            <span className="text-white/30 cursor-pointer"><Settings size={16} /></span>
                            <span className="text-white/30 cursor-pointer"><X size={16} /></span>
                        </div>
                    </div>

                    <div className={glass.content}>
                        
                        {/* Tab Navigation */}
                        <div className="flex gap-6 border-b border-white/10 pb-2 mb-2">
                            <button onClick={() => setActiveTab('stats')} className={`pb-2 border-b-2 font-bold text-sm uppercase tracking-wide transition-colors ${activeTab === 'stats' ? 'border-white/60 text-white/60' : 'border-transparent text-white/40 hover:text-white/70'}`}>ХАРАКТЕРИСТИКИ</button>
                            <button onClick={() => setActiveTab('inventory')} className={`pb-2 border-b-2 font-bold text-sm uppercase tracking-wide transition-colors relative ${activeTab === 'inventory' ? 'border-white/60 text-white/60' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                                ИНВЕНТАРЬ
                                <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] ${activeTab === 'inventory' ? 'bg-white/20 text-white/60' : 'bg-white/10 text-white/50'}`}>12</span>
                            </button>
                            <button onClick={() => setActiveTab('notes')} className={`pb-2 border-b-2 font-bold text-sm uppercase tracking-wide transition-colors ${activeTab === 'notes' ? 'border-white/60 text-white/60' : 'border-transparent text-white/40 hover:text-white/70'}`}>ЗАМЕТКИ</button>
                        </div>

                        {/* Rendering Variants */}
                        {selectedVariant === 'v1' && <LayoutVariant1 activeTab={activeTab} />}
                        {selectedVariant === 'v2' && <LayoutVariant2 activeTab={activeTab} />}
                        {selectedVariant === 'v3' && <LayoutVariant3 activeTab={activeTab} />}

                    </div>
                </div>

                {/* Example Context Menu Mockup floating near */}
                <div className={`absolute left-10 top-1/3 w-48 flex flex-col overflow-hidden bg-[#151c2b]/70 backdrop-blur-3xl border border-white/10 rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.6)] z-20`}>
                    <div className="px-3 py-2 text-[9px] text-white/40 font-bold border-b border-white/5 uppercase tracking-widest">
                        Контекстное меню
                    </div>
                    <div className="p-1 flex flex-col gap-0.5">
                        <button className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors flex items-center gap-3 text-white/80`}>
                            <Settings size={14} className="text-white/60" /> Настроить
                        </button>
                        <button className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-white/10 transition-colors flex items-center gap-3 text-white/80`}>
                            <Backpack size={14} className="text-white/60" /> В инвентарь
                        </button>
                        <button className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-red-500/20 text-red-400 transition-colors flex items-center gap-3 mt-1 border-t border-white/5 pt-2`}>
                            <X size={14} /> Удалить
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}

// ─── LAYOUT 1: COMPACT LISTS & BARS ───
function LayoutVariant1({ activeTab }: { activeTab: string }) {
    return (
        <div className="flex gap-6 items-start">
            {activeTab === 'stats' && (
                <div className="flex-1 flex flex-col gap-6">
                
                {/* Wounds (Accumulative bar Left to Right) */}
                <div className={glass.blockBg}>
                    <div className={glass.blockHeader}><span>Накопление РАН (Полоса)</span></div>
                    <div className="flex items-center gap-4">
                        <div className="flex-1 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 flex">
                            {/* Filling wounds from left */}
                            <div className="h-full bg-red-500 w-[40%] shadow-[0_0_15px_rgba(239,68,68,0.5)]"></div>
                        </div>
                        <div className="flex items-center gap-2">
                            <input type="text" className={`w-12 text-center text-red-400 ${glass.input}`} defaultValue="8" />
                            <span className="text-white/30 text-xs">из</span>
                            <span className="text-white/50 text-sm font-mono px-2">20</span>
                        </div>
                    </div>
                    <div className="mt-2 text-[10px] text-red-400/60 uppercase text-right tracking-widest">Тяжело ранен</div>
                </div>

                {/* Power (Мощь) - Compact Tags */}
                <div className="bg-gradient-to-br from-white/10 to-white/5 border border-white/10 rounded-xl p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
                    <div className={glass.blockHeader}><span className="text-white">СИСТЕМА: МОЩЬ</span></div>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-cyan-500/30">
                            <div className="flex items-center gap-2">
                                <Wind size={16} className="text-cyan-400" />
                                <span className="text-cyan-100 text-sm font-bold tracking-wide">Астрал</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-white/40">База: 2</span>
                                <div className="bg-cyan-500/20 border border-cyan-500/50 text-cyan-200 px-3 py-1 rounded font-mono font-bold">3</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-yellow-500/30">
                            <div className="flex items-center gap-2">
                                <Sparkles size={16} className="text-yellow-400" />
                                <span className="text-yellow-100 text-sm font-bold tracking-wide">Эфир</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-white/40">База: 3</span>
                                <div className="bg-yellow-500/20 border border-yellow-500/50 text-yellow-200 px-3 py-1 rounded font-mono font-bold">3</div>
                            </div>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-lg bg-black/30 border border-fuchsia-500/30">
                            <div className="flex items-center gap-2">
                                <Ghost size={16} className="text-fuchsia-400" />
                                <span className="text-fuchsia-100 text-sm font-bold tracking-wide">Аура</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-white/40">База: 1</span>
                                <div className="bg-fuchsia-500/20 border border-fuchsia-500/50 text-fuchsia-200 px-3 py-1 rounded font-mono font-bold">1</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attributes */}
                <div className={glass.blockBg}>
                    <div className={glass.blockHeader}>Атрибуты (Компактно)</div>
                    <div className="flex flex-col gap-1">
                        {['Телосложение', 'Ловкость', 'Мышление'].map((a) => (
                            <div key={a} className="flex justify-between items-center py-1 border-b border-white/5">
                                <span className="text-white/60 text-sm">{a}</span>
                                <span className="text-white bg-black/30 px-2 py-0.5 rounded font-mono border border-white/5">2</span>
                            </div>
                        ))}
                    </div>
                </div>

                </div>
            )}

            {activeTab === 'inventory' && (
                <div className="flex-1 flex flex-col gap-6 w-full max-w-lg">
                    {/* Inventory (List) */}
                    <div className={glass.blockBg}>
                        <div className={glass.blockHeader}>
                            <span>Экипировка (Список)</span>
                            <div className="flex gap-2">
                                <button className="text-white/40 hover:text-white"><ListIcon size={14}/></button>
                                <button className="text-white/20 hover:text-white"><Grid size={14}/></button>
                            </div>
                        </div>
                        
                        <div className="flex flex-col gap-2">
                            {/* Weapon colored */}
                            <div className="bg-orange-500/10 border-l-2 border-orange-500 p-2 rounded flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-orange-100 font-bold text-sm flex items-center gap-2"><Sword size={14} className="text-orange-400" /> Длинный Меч</span>
                                    <span className="text-[9px] text-orange-400/70 uppercase">Оружие ближнего боя</span>
                                </div>
                                <span className="bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded text-xs border border-orange-500/30">Урон 3</span>
                            </div>
                            {/* Armor colored */}
                            <div className="bg-blue-500/10 border-l-2 border-blue-500 p-2 rounded flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-blue-100 font-bold text-sm flex items-center gap-2"><Shield size={14} className="text-blue-400" /> Старый Щит</span>
                                    <span className="text-[9px] text-blue-400/70 uppercase">Броня</span>
                                </div>
                                <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded text-xs border border-blue-500/30">Броня 1</span>
                            </div>
                            {/* Regular Item */}
                            <div className="bg-white/5 border-l-2 border-gray-500 p-2 rounded flex justify-between items-center">
                                <div className="flex flex-col">
                                    <span className="text-gray-200 font-bold text-sm flex items-center gap-2"><Box size={14} className="text-gray-400" /> Факел</span>
                                    <span className="text-[9px] text-gray-500 uppercase">Освещение</span>
                                </div>
                                <span className="text-gray-500 text-xs">Кол-во: 3</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'notes' && (
                <div className="flex-1 flex flex-col gap-6 w-full">
                    <div className={glass.blockBg}>
                        <div className={glass.blockHeader}>ЛОГ И ЗАМЕТКИ</div>
                        <div className="text-white/50 text-sm">Здесь находится текст истории персонажа...</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── LAYOUT 2: CARDS & TICKBOXES ───
function LayoutVariant2({ activeTab }: { activeTab: string }) {
    return (
        <div className="flex gap-6 items-start">
            {activeTab === 'stats' && (
                <div className="flex-1 flex flex-col gap-6">
                
                {/* Wounds (Segmented Ticks) */}
                <div className={glass.blockBg}>
                    <div className={glass.blockHeader}><span>Накопление РАН (Сегменты)</span></div>
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Checkboxes representing wounds. E.g. max 10. 4 wounded */}
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => (
                                <div key={i} className={`w-6 h-6 rounded-md flex items-center justify-center border transition-all ${i <= 6 ? 'bg-red-500/20 border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)] text-red-400' : 'bg-black/40 border-white/10 text-transparent'}`}>
                                    {i <= 6 ? <X size={14} strokeWidth={3} /> : ''}
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-between items-center mt-2">
                            <span className="text-xs text-white/40">Остаток здоровья: <strong className="text-white">4</strong></span>
                            <div className="flex gap-1">
                                <button className="p-1 px-3 bg-white/10 hover:bg-white/20 rounded text-xs text-white">- Рана</button>
                                <button className="p-1 px-3 bg-red-500/20 hover:bg-red-500/40 border border-red-500/30 rounded text-xs text-red-200">+ Рана</button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Power (Мощь) - Large Cards */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className={glass.blockHeader}><span className="text-white flex items-center gap-2"><Sparkle size={14}/> СИСТЕМА: МОЩЬ (Карточки)</span></div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="flex flex-col items-center bg-cyan-950/20 border border-cyan-500/20 p-3 rounded-xl hover:border-cyan-500/50 transition-colors shadow-[inset_0_0_20px_rgba(6,182,212,0.05)] text-center relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-1 w-full flex justify-end">
                              <span className="text-[8px] bg-cyan-500/20 text-cyan-200 px-1 rounded uppercase tracking-widest border border-cyan-500/30 flex items-center gap-1 group-hover:bg-cyan-500 transition-colors group-hover:text-black">Актив</span>
                            </div>
                            <Wind size={20} className="text-cyan-400 mb-2 mt-2" />
                            <span className="text-cyan-100 text-xs font-bold mb-1">Астрал</span>
                            <span className="text-2xl font-mono text-white mb-2 font-bold drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">3</span>
                            <span className="text-[10px] text-cyan-400/50 uppercase">База 2</span>
                        </div>
                        
                        <div className="flex flex-col items-center bg-yellow-950/20 border border-yellow-500/20 p-3 rounded-xl hover:border-yellow-500/50 transition-colors text-center grayscale focus-within:grayscale-0 hover:grayscale-0">
                            <Sparkles size={20} className="text-yellow-400 mb-2 mt-2 opacity-50" />
                            <span className="text-yellow-100/50 text-xs font-bold mb-1">Эфир</span>
                            <span className="text-2xl font-mono text-white/50 mb-2">3</span>
                            <span className="text-[10px] text-yellow-400/30 uppercase">База 3</span>
                        </div>

                        <div className="flex flex-col items-center bg-fuchsia-950/20 border border-fuchsia-500/20 p-3 rounded-xl hover:border-fuchsia-500/50 transition-colors text-center grayscale focus-within:grayscale-0 hover:grayscale-0">
                            <Ghost size={20} className="text-fuchsia-400 mb-2 mt-2 opacity-50" />
                            <span className="text-fuchsia-100/50 text-xs font-bold mb-1">Аура</span>
                            <span className="text-2xl font-mono text-white/50 mb-2">1</span>
                            <span className="text-[10px] text-fuchsia-400/30 uppercase">База 1</span>
                        </div>
                    </div>
                </div>

                {/* Attributes Grid */}
                <div className={glass.blockBg}>
                    <div className={glass.blockHeader}>Атрибуты (Сетка)</div>
                    <div className="grid grid-cols-3 gap-3">
                        {['Тело', 'Ловкость', 'Мысль'].map((a) => (
                            <div key={a} className="bg-black/30 border border-white/5 rounded-lg p-2 flex flex-col items-center justify-center">
                                <span className="text-white/40 text-[10px] uppercase mb-1 tracking-widest text-center h-6">{a}</span>
                                <span className="text-white text-lg font-mono">2</span>
                            </div>
                        ))}
                    </div>
                </div>

                </div>
            )}

            {activeTab === 'inventory' && (
                <div className="flex-1 flex flex-col gap-6 w-full max-w-2xl">
                    {/* Inventory (Cards View) */}
                    <div className={glass.blockBg}>
                        <div className={glass.blockHeader}>
                            <span>Экипировка (Сетка)</span>
                            <div className="flex gap-2">
                                <button className="text-white/20 hover:text-white"><ListIcon size={14}/></button>
                                <button className="text-white/40 hover:text-white"><Grid size={14}/></button>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            {/* Weapon Card (Orange Tint) */}
                            <div className="bg-black/30 border-t border-b border-r border-l-4 border-l-orange-500 border-white/5 p-3 rounded-lg flex flex-col justify-between h-24 relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-orange-500/20 rounded-bl-lg px-2 py-0.5 border-b border-l border-orange-500/20">
                                    <span className="text-[9px] text-orange-400 uppercase font-bold tracking-widest">Оружие</span>
                                </div>
                                <div className="flex items-start gap-2 pt-1">
                                    <div className="bg-orange-500/10 p-1.5 rounded"><Sword size={16} className="text-orange-400" /></div>
                                    <span className="text-orange-100 font-bold text-sm leading-tight">Длинный Меч</span>
                                </div>
                                <div className="mt-auto">
                                    <span className="bg-orange-900/50 text-orange-200 px-2 py-0.5 rounded text-xs font-mono">УРОН 3</span>
                                </div>
                            </div>

                            {/* Armor Card (Blue Tint) */}
                            <div className="bg-black/30 border-t border-b border-r border-l-4 border-l-blue-500 border-white/5 p-3 rounded-lg flex flex-col justify-between h-24 relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-blue-500/20 rounded-bl-lg px-2 py-0.5 border-b border-l border-blue-500/20">
                                    <span className="text-[9px] text-blue-400 uppercase font-bold tracking-widest">Броня</span>
                                </div>
                                <div className="flex items-start gap-2 pt-1">
                                    <div className="bg-blue-500/10 p-1.5 rounded"><Shield size={16} className="text-blue-400" /></div>
                                    <span className="text-blue-100 font-bold text-sm leading-tight">Старый Щит</span>
                                </div>
                                <div className="mt-auto">
                                    <span className="bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded text-xs font-mono">БРОНЯ 1</span>
                                </div>
                            </div>

                            {/* Item Card (Gray) */}
                            <div className="bg-black/30 border-t border-b border-r border-l-4 border-l-gray-500 border-white/5 p-3 rounded-lg flex flex-col justify-between h-24 relative overflow-hidden">
                                <div className="absolute top-0 right-0 bg-gray-500/20 rounded-bl-lg px-2 py-0.5 border-b border-l border-gray-500/20">
                                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Предмет</span>
                                </div>
                                <div className="flex items-start gap-2 pt-1">
                                    <div className="bg-gray-500/10 p-1.5 rounded"><Box size={16} className="text-gray-400" /></div>
                                    <span className="text-gray-200 font-bold text-sm leading-tight">Зелье Сил</span>
                                </div>
                                <div className="mt-auto flex justify-between">
                                    <span className="text-gray-500 text-xs">x3</span>
                                    <button className="text-[10px] bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded text-white transition-colors">Выпить</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'notes' && (
                <div className="flex-1 flex flex-col gap-6 w-full">
                    <div className={glass.blockBg}>
                        <div className={glass.blockHeader}>ЛОГ И ЗАМЕТКИ</div>
                        <div className="text-white/50 text-sm">Здесь находится текст лора персонажа или заметки...</div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── LAYOUT 3: DETAILED / RADIAL ───
function LayoutVariant3({ activeTab }: { activeTab: string }) {
    return (
        <div className="flex gap-6 items-start w-full">
            {activeTab === 'stats' && (
                <div className="flex-1 flex flex-col gap-6 w-full">
                
                {/* Wounds (Detailed Stack) */}
                <div className={glass.blockBg}>
                    <div className={glass.blockHeader}><span>Накопление РАН (Шкала)</span></div>
                    <div className="flex items-center gap-6">
                        {/* Circular/Text representation */}
                        <div className="flex flex-col items-center justify-center w-16 h-16 rounded-full border-4 border-red-900 relative">
                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle cx="30" cy="30" r="28" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-red-500 shadow-xl" strokeDasharray="175" strokeDashoffset="75" />
                            </svg>
                            <span className="text-xl font-bold text-white relative z-10">8</span>
                            <span className="text-[8px] text-red-500 relative z-10 -mt-1 uppercase">РАН</span>
                        </div>
                        <div className="flex-1">
                            <div className="flex justify-between text-xs text-white/50 mb-1">
                                <span>Здоров</span>
                                <span>Смерть</span>
                            </div>
                            <div className="h-2 w-full bg-gradient-to-r from-green-500/20 via-yellow-500/20 to-red-500/20 rounded-full flex relative">
                                <div className="w-[40%] bg-white rounded-full shadow-[0_0_10px_white]"></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Power (Мощь) - Stacked / Descriptive */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-xl">
                    <div className={glass.blockHeader}><span className="text-white">СИСТЕМА: МОЩЬ (Стековая шкала)</span></div>
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-2 w-32 border-r border-white/10 pr-4">
                            <span className="text-xs text-white/40 uppercase text-center mb-1 font-bold">Активно</span>
                            <div className="bg-gradient-to-br from-cyan-600 to-blue-600 rounded-xl p-3 flex flex-col items-center border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                                <Wind size={24} className="text-white mb-1" />
                                <span className="text-white font-bold">Астрал</span>
                                <span className="text-2xl text-white font-mono mt-2">3</span>
                            </div>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-3">
                            {/* Bars representing energies in relation to each other */}
                            <div className="flex items-center gap-3">
                                <span className="w-12 text-right text-xs text-cyan-400 font-bold uppercase">Астрал</span>
                                <div className="flex-1 h-2 bg-black/40 rounded-full flex">
                                    <div className="h-full bg-cyan-400 rounded-full w-[60%] shadow-[0_0_5px_currentColor]"></div>
                                </div>
                                <span className="text-white font-mono w-4">3</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-12 text-right text-xs text-yellow-500 font-bold uppercase">Эфир</span>
                                <div className="flex-1 h-2 bg-black/40 rounded-full flex">
                                    <div className="h-full bg-yellow-500 rounded-full w-[80%] opacity-50"></div>
                                </div>
                                <span className="text-white/50 font-mono w-4">4</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="w-12 text-right text-xs text-fuchsia-400 font-bold uppercase">Аура</span>
                                <div className="flex-1 h-2 bg-black/40 rounded-full flex">
                                    <div className="h-full bg-fuchsia-400 rounded-full w-[20%] opacity-50"></div>
                                </div>
                                <span className="text-white/50 font-mono w-4">1</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Attributes (Tags) */}
                <div className={glass.blockBg}>
                    <div className={glass.blockHeader}>Атрибуты (Инлайн Теги)</div>
                    <div className="flex flex-wrap gap-2">
                        {['Тело 2', 'Ловкость 3', 'Мышление 4', 'Харизма 1', 'Фигура 2'].map((a) => (
                            <div key={a} className="bg-black/40 border border-white/10 px-3 py-1.5 rounded-full flex items-center justify-center text-sm">
                                <span className="text-white/60 mr-2">{a.split(' ')[0]}</span>
                                <span className="text-white font-bold">{a.split(' ')[1]}</span>
                            </div>
                        ))}
                    </div>
                </div>

                </div>
            )}

            {activeTab === 'inventory' && (
                <div className="flex-1 flex flex-col gap-6 w-full max-w-3xl">
                    {/* Inventory (Detailed List) */}
                    <div className={glass.blockBg}>
                        <div className={glass.blockHeader}>
                            <span>Экипировка (Детально)</span>
                        </div>
                        
                        <div className="flex flex-col gap-3">
                            {/* Weapon Detailed block */}
                            <div className="bg-gradient-to-r from-orange-500/10 to-transparent border-l-[3px] border-orange-500 rounded p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2">
                                        <Sword size={18} className="text-orange-400" />
                                        <div className="flex flex-col">
                                            <span className="text-orange-100 font-bold leading-none">Длинный Меч</span>
                                            <div className="flex gap-2 mt-1 -ml-1">
                                                <span className="text-[10px] bg-orange-950/60 text-orange-400 px-1.5 border border-orange-900 rounded">ОРУЖИЕ</span>
                                                <span className="text-[10px] bg-black/40 text-gray-400 px-1.5 border border-gray-800 rounded">ДВУРУЧНОЕ</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button className="text-white/30 hover:text-white p-1 hover:bg-white/10 rounded"><Settings size={14}/></button>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm bg-black/20 p-2 rounded border border-white/5">
                                    <div className="flex justify-between items-center"><span className="text-white/40 text-[10px] uppercase">Урон</span><span className="text-orange-300 font-mono">3</span></div>
                                    <div className="flex justify-between items-center"><span className="text-white/40 text-[10px] uppercase">Точность</span><span className="text-orange-300 font-mono">+1</span></div>
                                    <div className="flex justify-between items-center"><span className="text-white/40 text-[10px] uppercase">Дистанция</span><span className="text-white/80 text-[10px] uppercase">Близкая</span></div>
                                    <div className="flex justify-between items-center"><span className="text-white/40 text-[10px] uppercase">Прочность</span><span className="text-white/80 font-mono">8/10</span></div>
                                </div>
                            </div>

                            {/* Armor Detailed block */}
                            <div className="bg-gradient-to-r from-blue-500/10 to-transparent border-l-[3px] border-blue-500 rounded p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex gap-2">
                                        <Shield size={18} className="text-blue-400" />
                                        <div className="flex flex-col">
                                            <span className="text-blue-100 font-bold leading-none">Старый Щит</span>
                                            <div className="flex gap-2 mt-1 -ml-1">
                                                <span className="text-[10px] bg-blue-950/60 text-blue-400 px-1.5 border border-blue-900 rounded">БРОНЯ</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-sm bg-black/20 p-2 rounded border border-white/5">
                                    <div className="flex justify-between items-center"><span className="text-white/40 text-[10px] uppercase">Защита</span><span className="text-blue-300 font-mono">1</span></div>
                                    <div className="flex justify-between items-center"><span className="text-white/40 text-[10px] uppercase">Штраф</span><span className="text-white/80 font-mono">0</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {activeTab === 'notes' && (
                <div className="flex-1 flex flex-col gap-6 w-full">
                    <div className={glass.blockBg}>
                        <div className={glass.blockHeader}>ЛОГ И ЗАМЕТКИ</div>
                        <div className="text-white/50 text-sm">Здесь находится текст лора персонажа или заметки...</div>
                    </div>
                </div>
            )}
        </div>
    );
}
