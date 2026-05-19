import { useState, useEffect, useRef, useMemo } from 'react';
import { yjsStore } from '../../store/yjsStore';
import type { ChatMessage } from '../../types';
import { rollEngine } from '../../services/rollEngine';
import { MessageSquare, Send, Dices, History, ScrollText } from 'lucide-react';

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
    const [messages, setMessages] = useState<ChatMessage[]>(() => yjsStore.chatArray.toArray());
    const [input, setInput] = useState('');
    const [activeTab, setActiveTab] = useState<'chat' | 'history' | 'events'>('chat');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const historyEndRef = useRef<HTMLDivElement>(null);
    const eventsEndRef = useRef<HTMLDivElement>(null);

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
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (activeTab === 'history') {
            historyEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        if (activeTab === 'events') {
            eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [activeTab, messages]);

    // Parse dice history from messages
    const diceHistory = useMemo(() => {
        return messages
            .map(parseDiceMessage)
            .filter((e): e is DiceHistoryEntry => e !== null)
            .reverse(); // newest first
    }, [messages]);

    const actionLog = useMemo(() => {
        return messages
            .filter((msg) => msg.isSystem && !parseDiceMessage(msg))
            .reverse(); // newest first
    }, [messages]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        if (trimmed.startsWith('/r ') || trimmed.startsWith('/roll ')) {
            const result = rollEngine.rollDiceCommand(trimmed);

            if (result) {
                if (result.error) {
                    yjsStore.sendMessage(`Ошибка: ${result.error}`, 'Система', true);
                } else {
                    const message = rollEngine.formatRollMessage(result.notation, result);

                    yjsStore.sendMessage(trimmed);
                    setTimeout(() => {
                        yjsStore.sendMessage(message, 'Система', true);
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
        <div className="flex flex-col h-full bg-black/20 border-l border-white/10 animate-in slide-in-from-right-8 duration-300 backdrop-blur-md">
            {/* Header with tabs */}
            <div className="p-3 border-b border-white/10 bg-white/5">
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => setActiveTab('chat')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'chat' ? 'bg-white/15 text-white shadow-md border border-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}
                    >
                        <MessageSquare size={14} />
                        Чат
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-white/15 text-white shadow-md border border-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}
                    >
                        <History size={14} />
                        Броски ({diceHistory.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('events')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'events' ? 'bg-white/15 text-white shadow-md border border-white/10' : 'text-white/40 hover:text-white/80 hover:bg-white/5 border border-transparent'}`}
                    >
                        <ScrollText size={14} />
                        События ({actionLog.length})
                    </button>
                </div>
            </div>

            {/* Chat tab */}
            {activeTab === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                        {messages.length === 0 ? (
                            <div className="text-center text-gray-500 text-xs italic mt-10">
                                Чат пуст. Напишите сообщение или используйте /r 1d20 для броска кубиков.
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

                    <div className="p-3 border-t border-white/10 bg-white/5">
                        <div className="flex bg-white/5 rounded-lg border border-white/10 focus-within:bg-white/10 focus-within:border-white/30 transition-all overflow-hidden backdrop-blur-sm shadow-inner">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Сообщение или /r 1d20+5..."
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
                            Подсказка: /r 2d6, /roll 1d20+3
                        </div>
                    </div>
                </>
            )}

            {/* History tab */}
            {activeTab === 'history' && (
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {diceHistory.length === 0 ? (
                        <div className="text-center text-gray-500 text-xs italic mt-10">
                            История бросков пуста. Бросьте кубики через чат, навыки или заметки.
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
                <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {actionLog.length === 0 ? (
                        <div className="text-center text-gray-500 text-xs italic mt-10">
                            Событий пока нет. Измените раны, статус или выдайте предмет игроку.
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
        </div>
    );
}
