import { useState, useEffect, useRef } from 'react';
import { yjsStore } from '../../store/yjsStore';
import type { ChatMessage } from '../../types';
import { parseAndRollDice } from '../../utils/diceParser';
import { MessageSquare, Send, Dices } from 'lucide-react';

export function ChatPanel() {
    const [messages, setMessages] = useState<ChatMessage[]>(() => yjsStore.chatArray.toArray());
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Observe changes
        const observer = () => {
            setMessages(yjsStore.chatArray.toArray());
        };

        yjsStore.chatArray.observe(observer);

        return () => {
            yjsStore.chatArray.unobserve(observer);
        };
    }, []);

    useEffect(() => {
        // Auto-scroll to bottom on new message
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        const trimmed = input.trim();
        if (!trimmed) return;

        // Check if it's a dice roll
        if (trimmed.startsWith('/r ') || trimmed.startsWith('/roll ')) {
            const result = parseAndRollDice(trimmed);

            if (result) {
                if (result.error) {
                    yjsStore.sendMessage(`Ошибка: ${result.error}`, 'Система', true);
                } else {
                    const rollsStr = result.rolls.length > 1 ? ` [${result.rolls.join(', ')}]` : '';
                    const modifierStr = result.modifier !== 0 ? ` (${result.modifier > 0 ? '+' : ''}${result.modifier})` : '';
                    const message = `Бросает ${result.notation}: **${result.total}** \n\n*${result.rolls.reduce((a, b) => a + b, 0)}${modifierStr}${rollsStr}*`;

                    // Send main message first
                    yjsStore.sendMessage(trimmed);
                    // Then system result
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
            <div className="p-3 border-b border-white/10 flex items-center justify-between bg-white/5">
                <h3 className="text-gray-200 font-bold flex items-center gap-2">
                    <MessageSquare size={16} className="text-white/50" />
                    Чат и Логи
                </h3>
            </div>

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
                                    {msg.isSystem && <Dices size={14} className="inline-block mr-2 text-white/50 mb-0.5" />}

                                    {/* Simple markdown-like bold parsing for dice results */}
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
        </div>
    );
}
