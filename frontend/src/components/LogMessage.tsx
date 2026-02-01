import React, { useState } from 'react';
import Ansi from 'ansi-to-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CopyButtonProps {
  text: string;
  className?: string;
}

const CopyButton: React.FC<CopyButtonProps> = ({ text, className = '' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`p-1.5 rounded-md transition-all duration-200 
        ${copied 
          ? 'text-green-400 bg-green-400/10' 
          : 'text-gray-400 hover:text-white hover:bg-white/10'
        } ${className}`}
      title="Copy to clipboard"
    >
      {copied ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      )}
    </button>
  );
};

interface LogMessageProps {
  content: string;
  type: 'log' | 'user';
}

const LogMessage: React.FC<LogMessageProps> = ({ content, type }) => {
  // eslint-disable-next-line no-control-regex
  const cleanContent = content.replace(/\x1b\[[0-9;]*m/g, '');

  if (type === 'user') {
    return (
      <div className="flex justify-end group items-center gap-2">
        <CopyButton 
          text={content} 
          className="opacity-0 group-hover:opacity-100 transition-opacity" 
        />
        <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-xl text-sm shadow-md font-sans">
          {content}
        </span>
      </div>
    );
  }

  const isMarkdown = 
    content.includes('```') || 
    (content.length > 50 && (content.includes('# ') || content.includes('**'))) ||
    content.startsWith('You are') ||
    content.startsWith('Agent');

  if (isMarkdown) {
    return (
      <div className="group relative prose prose-invert prose-sm max-w-none break-words text-gray-300 leading-7">
        
        <div className="absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyButton text={cleanContent} className="bg-[#1e1e1e] shadow-sm border border-white/10" />
        </div>

        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              const codeText = String(children).replace(/\n$/, '');

              return !inline && match ? (
                <div className="rounded-lg overflow-hidden my-4 border border-white/10 shadow-lg bg-[#1e1e1e]">
                  <div className="flex items-center justify-between px-4 py-1.5 bg-[#2d2d2d] border-b border-white/5">
                    <span className="text-xs text-gray-400 font-mono">{match[1]}</span>
                    <div className="flex items-center">
                      <CopyButton text={codeText} />
                    </div>
                  </div>
                  <SyntaxHighlighter
                    {...props}
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.85rem' }}
                  >
                    {codeText}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code {...props} className="bg-white/10 text-orange-300 rounded px-1.5 py-0.5 mx-1 text-xs font-mono">
                  {children}
                </code>
              );
            },
            a: ({ node, ...props }) => <a {...props} className="text-blue-400 hover:underline" />,
            ul: ({ node, ...props }) => <ul {...props} className="list-disc pl-6 my-2" />,
            li: ({ node, ...props }) => <li {...props} className="pl-1" />,
            p: ({ node, ...props }) => <p {...props} className="my-2" />,
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    );
  }

  return (
    <div className="group relative">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-700/50 rounded-full group-hover:bg-blue-500/50 transition-colors"></div>
      
      <div className="absolute top-1 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <CopyButton text={cleanContent} className="bg-[#1e1e1e]/80 backdrop-blur-sm border border-white/10" />
      </div>

      <div className="pl-4 py-1 overflow-x-auto">
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-300 break-all">
          <Ansi useClasses>{content}</Ansi>
        </pre>
      </div>
    </div>
  );
};

export default LogMessage;
