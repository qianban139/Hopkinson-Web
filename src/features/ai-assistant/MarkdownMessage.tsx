// src/features/ai-assistant/MarkdownMessage.tsx
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

interface MarkdownMessageProps {
  content: string;
}

export default function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        // Style overrides for dark theme
        p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-[#00F5FF]/90">{children}</strong>,
        em: ({ children }) => <em className="text-white/70 italic">{children}</em>,
        h1: ({ children }) => <h1 className="text-base font-bold text-white mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-[#00F5FF]/80 mb-1">{children}</h3>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-1.5">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-1.5">{children}</ol>,
        li: ({ children }) => <li className="text-white/80">{children}</li>,
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-[#0A2540] rounded-lg p-2.5 my-1.5 overflow-x-auto border border-[#00F5FF]/10">
                <code className="text-xs text-[#00F5FF]/80 font-mono">{children}</code>
              </pre>
            );
          }
          return (
            <code className="bg-[#0A2540]/80 px-1.5 py-0.5 rounded text-xs text-[#00F5FF]/80 font-mono" {...props}>
              {children}
            </code>
          );
        },
        table: ({ children }) => (
          <div className="overflow-x-auto my-1.5">
            <table className="text-xs border-collapse w-full">{children}</table>
          </div>
        ),
        thead: ({ children }) => <thead className="border-b border-[#00F5FF]/20">{children}</thead>,
        th: ({ children }) => <th className="px-2 py-1 text-left text-[#00F5FF]/70 font-medium">{children}</th>,
        td: ({ children }) => <td className="px-2 py-1 border-t border-white/5 text-white/70">{children}</td>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-[#00F5FF]/30 pl-3 my-1.5 text-white/60 italic">{children}</blockquote>
        ),
        hr: () => <hr className="border-[#00F5FF]/10 my-2" />,
        a: ({ href, children }) => (
          <a href={href} className="text-[#00F5FF] underline underline-offset-2 hover:text-[#00F5FF]/80" target="_blank" rel="noopener noreferrer">{children}</a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
