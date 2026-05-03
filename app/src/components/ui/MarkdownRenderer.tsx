import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EntityLink } from './EntityLink';

interface MarkdownRendererProps {
    content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
    // Pre-process custom [[Wiki Links]] to standard markdown links with a specific scheme
    const processedContent = content.replace(/\[\[(.*?)\]\]/g, (_match, entityName) => {
        return `[${entityName}](#entity:${encodeURIComponent(entityName)})`;
    });

    return (
        <div className="markdown-body text-gray-300 leading-relaxed text-sm">
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    a: ({ node, href, children, ...props }) => {
                        if (href && href.startsWith('#entity:')) {
                            const entityName = decodeURIComponent(href.replace('#entity:', ''));

                            return <EntityLink key={entityName} entityName={entityName}>{children}</EntityLink>;
                        }

                        // Default generic link
                        return (
                            <a {...props} href={href} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                                {children}
                            </a>
                        );
                    },
                    // Apply global styling for markdown elements to fit the dark theme
                    h1: ({ children }) => <h1 className="text-xl font-bold text-white mb-4 mt-6 pb-2 border-b border-gray-800">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold text-gray-200 mb-3 mt-5">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-bold text-gray-300 mb-2 mt-4">{children}</h3>,
                    p: ({ children }) => <p className="mb-3 leading-relaxed">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc list-inside mb-4 space-y-1 text-gray-300 marker:text-white/60">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside mb-4 space-y-1 text-gray-300">{children}</ol>,
                    blockquote: ({ children }) => <blockquote className="border-l-4 border-white/20 pl-4 py-1 italic bg-white/60/10 text-gray-400 mb-4 rounded-r">{children}</blockquote>,
                    code: ({ node, inline, children, className, ...props }: any) => {
                        return inline ? (
                            <code className="bg-black/30 text-white/70 px-1.5 py-0.5 rounded text-xs font-mono border border-white/5 shadow-inner" {...props}>
                                {children}
                            </code>
                        ) : (
                            <pre className="bg-[#0a0c10]/80 p-3 rounded-md border border-white/10 shadow-inner overflow-x-auto mb-4 custom-scrollbar backdrop-blur-sm">
                                <code className="text-xs text-green-400 font-mono" {...props}>
                                    {children}
                                </code>
                            </pre>
                        );
                    },
                    table: ({ children }) => <div className="overflow-x-auto mb-4"><table className="w-full text-left border-collapse">{children}</table></div>,
                    thead: ({ children }) => <thead className="bg-black/30 text-emerald-200/50 border-b border-white/10">{children}</thead>,
                    th: ({ children }) => <th className="p-2 font-semibold text-xs uppercase tracking-wider">{children}</th>,
                    td: ({ children }) => <td className="p-2 border-b border-gray-800/50 text-gray-300">{children}</td>,
                    hr: () => <hr className="border-gray-800 my-6" />
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
};
