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
  // 1. 用户消息
  if (type === 'user') {
    return (
      <div className="flex justify-end">
        <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-xl text-sm shadow-md font-sans">
          {content}
        </span>
      </div>
    );
  }

  // 2. 预处理
  // 移除 ANSI 码用于检测 Markdown 特征，但在渲染 Bash 时我们要保留原 ANSI 码
  // eslint-disable-next-line no-control-regex
  const cleanContent = content.replace(/\x1b\[[0-9;]*m/g, '');

  // 3. 智能判断逻辑 (修复换行问题的核心)
  // 只有当内容看起来真的像“自然语言对话”或“包含Markdown代码块”时，才启用 Markdown 渲染。
  // bash 工具输出（如 ls, cat）通常不包含 # 标题，也不包含 ``` 代码块（除非是 cat 一个代码文件，但那时我们希望它是原样的）
  const isMarkdown = 
    content.includes('```') || 
    (content.length > 50 && (content.includes('# ') || content.includes('**'))) ||
    content.startsWith('You are') || // System prompt echo
    content.startsWith('Agent');     // Agent status

  // --- 分支 A: 智能体对话 (Markdown 渲染) ---
  if (isMarkdown) {
    return (
      <div className="prose prose-invert prose-sm max-w-none break-words text-gray-300 leading-7">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // 代码块高亮
            code({ node, inline, className, children, ...props }: any) {
              const match = /language-(\w+)/.exec(className || '');
              return !inline && match ? (
                <div className="rounded-lg overflow-hidden my-4 border border-white/10 shadow-lg bg-[#1e1e1e]">
                  <div className="flex items-center justify-between px-4 py-1.5 bg-[#2d2d2d] border-b border-white/5">
                    <span className="text-xs text-gray-400 font-mono">{match[1]}</span>
                  </div>
                  <SyntaxHighlighter
                    {...props}
                    style={vscDarkPlus}
                    language={match[1]}
                    PreTag="div"
                    customStyle={{ margin: 0, padding: '1rem', background: 'transparent', fontSize: '0.85rem' }}
                  >
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                </div>
              ) : (
                <code {...props} className="bg-white/10 text-orange-300 rounded px-1.5 py-0.5 mx-1 text-xs font-mono">
                  {children}
                </code>
              );
            },
            // 链接、列表、表格样式保持不变...
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

  // --- 分支 B: 工具输出/终端日志 (LS, ReadFile, Bash) ---
  // 这里是修复 LS 乱码和 ReadFile 不高亮的关键
  return (
    <div className="group relative">
      {/* 装饰条：标示这是终端输出 */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-700/50 rounded-full group-hover:bg-blue-500/50 transition-colors"></div>
      
      <div className="pl-4 py-1 overflow-x-auto">
        {/* 关键 CSS 类：
           1. whitespace-pre-wrap: 保留 ls 的换行符，遇到长行自动换行
           2. font-mono: 等宽字体，对齐表格
           3. text-gray-300: 默认颜色设为亮灰，防止 read_file 读出来的纯文本变成黑色
        */}
        <pre className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-gray-300 break-all">
          <Ansi useClasses>{content}</Ansi>
        </pre>
      </div>
    </div>
  );
};

export default LogMessage;