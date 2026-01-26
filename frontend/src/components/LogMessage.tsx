import React from 'react';
import Ansi from 'ansi-to-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface LogMessageProps {
  content: string;
  type: 'log' | 'user';
}

const LogMessage: React.FC<LogMessageProps> = ({ content, type }) => {
  // 1. 如果是用户的消息，简单渲染
  if (type === 'user') {
    return (
      <span className="inline-block bg-blue-600/20 text-blue-200 px-3 py-2 rounded-lg text-sm">
        {content}
      </span>
    );
  }

  // 2. 智能判断逻辑：
  // 如果内容包含代码块标志 (```)，我们认为它是 LLM 的回答，使用 Markdown 渲染并高亮代码。
  // 否则，我们认为它是工具输出或系统日志，使用 ANSI 渲染以保留终端颜色。
  const isMarkdown = content.includes('```');

  if (isMarkdown) {
    // Markdown 渲染时，因为后端可能在外面包了一层 ANSI 颜色代码，我们需要先清理掉，
    // 否则 Markdown 解析器会把颜色代码当成文本显示出来。
    // eslint-disable-next-line no-control-regex
    const cleanContent = content.replace(/\x1b\[[0-9;]*m/g, '');

    return (
      <div className="prose prose-invert prose-sm max-w-none text-gray-300">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // 自定义代码块渲染逻辑
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="rounded-md overflow-hidden my-2 border border-white/10 shadow-lg">
                  {/* 代码块头部装饰 */}
                  <div className="bg-[#1e1e1e] px-4 py-1 flex items-center gap-2 border-b border-white/5">
                    <div className="flex gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500/80"></div>
                    </div>
                    <span className="text-xs text-gray-500 ml-2">{match[1]}</span>
                  </div>
                  {/* 代码高亮组件 */}
                  <SyntaxHighlighter
                    {...props}
                    style={vscDarkPlus} // 使用 VSCode 深色主题
                    language={match[1]}
                    PreTag="div"
                    customStyle={{
                      margin: 0,
                      borderRadius: 0,
                      background: '#1e1e1e', // 统一背景色
                      fontSize: '0.85rem',
                      lineHeight: '1.5'
                    }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code {...props} className="bg-white/10 text-orange-300 rounded px-1 py-0.5 mx-1">
                  {children}
                </code>
              );
            }
          }}
        >
          {cleanContent}
        </ReactMarkdown>
      </div>
    );
  }

  // 3. 纯终端日志（Bash输出、工具调用等），使用 ANSI 渲染
  return (
    <div className="whitespace-pre-wrap break-words font-mono text-sm leading-relaxed border-l-2 border-transparent pl-2 hover:border-gray-700 transition-colors">
      <Ansi useClasses>{content}</Ansi>
    </div>
  );
};

export default LogMessage;