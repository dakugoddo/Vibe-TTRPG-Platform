import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { yjsStore } from '../../store/yjsStore';
import type { ChatMessage } from '../../types';
import { rollEngine } from '../../services/rollEngine';
import { ArrowDown, MessageSquare, Send, Dices, History, ScrollText } from 'lucide-react';

interface DiceHistoryEntry {
    id: string;
    expression: string;
    total: number;
    rolls: number[];
    faces: number;
    timestamp: number;
}

/** Parse a dice result system message into a history entry */
function parseDiceMessage(msg: ChatMessage): DiceHistoryEntry | null {
    if (!msg.isSystem) return null;
    const text = msg.text;
    // Match format: "🎲 expression: **total**"
    const match = text.match(/🎲\s+(.+?):\s*\*\*(\d+)\*\*/);
    if (!match) return null;

    const expression = match[1].trim();
    const total = parseInt(match[2], 10);

    // Parse rolls from the detail line: "*sum [rolls]*"
    const rollsMatch = text.match(/\*\s*(\d+)\s*(?:\([^)]*\))?\s*\[([\d,\s]+)\]/);
    let rolls: number[] = [];
    if (rollsMatch) {
        rolls = rollsMatch[2].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }

    // Try to determine faces from expression
    const diceMatch = expression.match(/(\d*)d(\d+)/);
    const faces = diceMatch ? parseInt(diceMatch[2], 10) : 6;

    return {
        id: msg.id,
        expression,
        total,
        rolls,
        faces,
        timestamp: msg.timestamp,
    };
}

export function ChatPanel() {
    const { t } = useTranslation();
    const [messages, setMessages] = useState<ChatMessage[]>(() => yjsStore.chatArray.toArray());
    const [input, setInput] = useState('');
    const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'events'>('chat');
    const [showJumpToLatest, setShowJumpToLatest] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const historyScrollRef = useRef<HTMLDivElement>(null);
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const historyEndRef = useRef<HTMLDivElement>(null);
    const eventsEndRef = useRef<HTMLDivElement>(null);

    const getActiveScrollRef = useCallback((tab: typeof activeTab = activeTab) => {
        if (tab === 'history') return historyScrollRef;
        if (tab === 'events') return eventsScrollRef;
        return chatScrollRef;
    }, [activeTab]);

    const getActiveEndRef = useCallback((tab: typeof activeTab = activeTab) => {
        if (tab === 'history') return historyEndRef;
        if (tab === 'events') return eventsEndRef;
        return messagesEndRef;
    }, [activeTab]);

    const isNearBottom = (element: HTMLDivElement) =>
        element.scrollHeight - element.scrollTop - element.clientHeight < 64;

    const scrollToLatest = useCallback((tab: typeof activeTab = activeTab, behavior: ScrollBehavior = 'smooth') => {
        getActiveEndRef(tab).current?.scrollIntoView({ behavior, block: 'end' });
        setShowJumpToLatest(false);
    }, [activeTab, getActiveEndRef]);

    const handleScroll = useCallback(() => {
        const element = getActiveScrollRef().current;
        if (!element) return;
        setShowJumpToLatest(!isNearBottom(element));
    }, [getActiveScrollRef]);

    useEffect(() => {
        const observer = () => {
            setMessages(yjsStore.chatArray.toArray());
        };
        yjsStore.chatArray.observe(observer);
        return () => {
            yjsStore.chatArray.unobserve(observer);
        };
    }, []);

    useEffect(() => {
        requestAnimationFrame(() => scrollToLatest(activeTab, 'auto'));
    }, [activeTab, scrollToLatest]);

    useEffect(() => {
        const element = getActiveScrollRef().current;
        if (!element || showJumpToLatest) return;
        requestAnimationFrame(() => scrollToLatest(activeTab, 'smooth'));
    }, [activeTab, getActiveScrollRef, messages.length, scrollToLatest, showJumpToLatest]);

    // Parse dice history from messages
    const diceHistory = useMemo(() => {
        return messages
            .map(parseDiceMessage)
            .filter((e): e is DiceHistoryEntry => e !== null)
    }, [messages]);

    const actionLog = useMemo(() => {
        return messages
            .filter((msg) => msg.isSystem && !parseDiceMessage(msg));
    }, [messages]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('/r ') || trimmed.startsWith('/roll ')) {
            const result = rollEngine.rollDiceCommand(trimmed);

            if (result) {
                if (result.error) {
                    yjsStore.sendMessage(t('chat.rollError', { error: result.error }), t('chat.systemSender'), true);
                } else {
                    const message = rollEngine.formatRollMessage(result.notation, result);

                    yjsStore.sendMessage(trimmed);
                    setTimeout(() => {
                        yjsStore.sendMessage(message, t('chat.systemSender'), true);
                    }, 50);
                }
            }
        } else {
            yjsStore.sendMessage(trimmed);
        }

        setInput('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden bg-black/20 border-l border-white/10 animate-in slide-in-from-right-8 duration-300 backdrop-blur-md">
            {/* Header with tabs */}
            <div className="p-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'chat' ? 'bg-white/15 text-white shadow-md border border-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}
                    >
                        <MessageSquare size={14} />
                        {t('chat.tabs.chat')}
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-white/15 text-white shadow-md border border-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}
                    >
                        <History size={14} />
                        {t('chat.tabs.rolls', { count: diceHistory.length })}
                    </button>
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'events' ? 'bg-white/15 text-white shadow-md border border-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}
                    >
                        <ScrollText size={14} />
                        {t('chat.tabs.events', { count: actionLog.length })}
                    </button>
                </div>
            </div>

            {/* Chat tab */}
            {activeTab === 'chat' && (
                <>
                    <div ref={chatScrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto p-3 pb-5 space-y-3 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-500 text-xs italic mt-10">
                                {t('chat.emptyChat')}
                            </div>
                        ) : (
                            messages.map((msg, index) => {
                                const isMe = msg.sender === yjsStore.localPlayerName;
                                const showHeader = index === 0 || messages[index - 1].sender !== msg.sender || (msg.timestamp - messages[index - 1].timestamp > 60000);

                                return (
                                    <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${msg.isSystem ? 'items-center my-4' : ''}`}>
                                        {!msg.isSystem && showHeader && (
                                            <span className="text-[10px] text-gray-500 mb-1 px-1">
                                                {msg.sender} • {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        )}

                                        <div className={`px-3 py-2 rounded-lg max-w-[85%] text-sm ${msg.isSystem
                                            ? 'bg-white/50/30 border border-white/50/30 text-white/50 text-center w-full shadow-inner'
                                            : isMe
                                                ? 'bg-white/20 text-white rounded-tr-none shadow-md backdrop-blur-sm'
                                                : 'bg-black/40 text-white/90 rounded-tl-none border border-white/5 shadow-inner backdrop-blur-sm'
                                            }`}>
                                            {msg.isSystem && (
                                                parseDiceMessage(msg)
                                                    ? <Dices size={14} className="inline-block mr-2 text-white/50 mb-0.5" />
                                                    : <ScrollText size={14} className="inline-block mr-2 text-white/50 mb-0.5" />
                                            )}

                                            {msg.text.split('\n').map((line, i) => (
                                                <div key={i} className={`${line.startsWith('*') && line.endsWith('*') ? 'text-xs text-white/50/80 italic mt-1' : ''}`}>
                                                    {line.replace(/\*(.*?)\*/g, '').split('**').map((part, j) =>
                                                        j % 2 === 1 ? <strong key={j} className="text-white text-lg">{part}</strong> : part
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] border-t border-white/10 bg-white/5">
                        <div className="flex bg-white/5 rounded-lg border border-white/10 focus-within:bg-white/10 focus-within:border-white/30 transition-all overflow-hidden backdrop-blur-sm shadow-inner">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={t('chat.inputPlaceholder')}
                                className="flex-1 bg-transparent border-none text-sm text-white/90 px-3 py-2 outline-none placeholder:text-white/30"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim()}
                                className="px-3 text-emerald-400 hover:text-emerald-300 disabled:opacity-50 transition-colors"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        <div className="text-[9px] text-white/30 mt-1 pl-1 font-mono">
                            {t('chat.hint')}
                        </div>
                    </div>
                </>
            )}

            {/* History tab */}
            {activeTab === 'history' && (
                <div ref={historyScrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto p-3 pb-5 custom-scrollbar">
                    {diceHistory.length === 0 ? (
                        <div className="text-center text-gray-500 text-xs italic mt-10">
                            {t('chat.emptyRollHistory')}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {diceHistory.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-white/80 font-mono">
                                                {entry.expression}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-white/30">
                                                {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                            <span className="text-lg font-bold text-white font-mono bg-black/30 px-2 py-0.5 rounded-lg border border-white/5">
                                                {entry.total}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Individual dice visualization */}
                                    {entry.rolls.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                            {entry.rolls.map((roll, i) => {
                                                const isMax = roll === entry.faces;
                                                const isMin = roll === 1;
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono border transition-all ${
                                                            isMax
                                                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-[0_0_8px_rgba(74,222,128,0.3)]'
                                                                : isMin
                                                                    ? 'bg-red-500/20 text-red-400 border-red-500/40'
                                                                    : 'bg-white/10 text-white/70 border-white/10'
                                                        }`}
                                                    >
                                                        {roll}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                            <div ref={historyEndRef} />
                        </div>
                    )}
                </div>
            )}

            {/* Events tab */}
            {activeTab === 'events' && (
                <div ref={eventsScrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto p-3 pb-5 custom-scrollbar">
                    {actionLog.length === 0 ? (
                        <div className="text-center text-gray-500 text-xs italic mt-10">
                            {t('chat.emptyEvents')}
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {actionLog.map((entry) => (
                                <div
                                    key={entry.id}
                                    className="bg-white/5 border border-white/5 rounded-xl p-3 hover:bg-white/10 hover:border-white/10 transition-all"
                                >
                                    <div className="flex items-center justify-between gap-3 mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <ScrollText size={14} className="text-white/40 flex-shrink-0" />
                                            <span className="text-xs font-bold text-white/70 truncate">
                                                {entry.sender}
                                            </span>
                                        </div>
                                        <span className="text-[10px] text-white/30 flex-shrink-0">
                                            {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                        </span>
                                    </div>

                                    <div className="text-sm text-white/80 leading-relaxed">
                                        {entry.text.split('\n').map((line, i) => (
                                            <div key={i}>{line}</div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <div ref={eventsEndRef} />
                        </div>
                    )}
                </div>
            )}

            {showJumpToLatest && (
                <button
                    type="button"
                    onClick={() => scrollToLatest(activeTab)}
                    className="absolute bottom-20 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-[#111827]/90 text-white/70 shadow-[0_14px_35px_rgba(0,0,0,0.45)] backdrop-blur-xl transition-all hover:border-white/30 hover:bg-white/15 hover:text-white"
                    title={t('chat.jumpToLatest')}
                >
                    <ArrowDown size={16} />
                </button>
            )}
        </div>
    );
}
