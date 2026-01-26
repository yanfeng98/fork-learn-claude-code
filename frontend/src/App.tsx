import { useState, useRef, useEffect } from 'react';
import { Terminal, Upload, Play, Cpu, Loader2 } from 'lucide-react';

// 解析后端传来的 ANSI 颜色代码，简单转为 HTML 样式
const formatLog = (text: string) => {
  // 简单去除颜色代码，或者你可以引入 ansi-to-html 库来实现真彩色
  // 为了演示简单，这里只做简单的正则清洗，或者保留原始文本
  // 如果你想漂亮，可以用 span 包裹颜色
  // 这里做一个简单的清理演示：
  // eslint-disable-next-line no-control-regex
  return text.replace(/\x1b\[[0-9;]*m/g, '');
};

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [logs, setLogs] = useState<{ type: 'log' | 'user'; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      setSessionId(data.session_id);
      connectWebSocket(data.session_id);
    } catch (e) {
      console.error(e);
      alert("上传失败");
    } finally {
      setIsUploading(false);
    }
  };

  const connectWebSocket = (sid: string) => {
    const ws = new WebSocket(`ws://127.0.0.1:8000/ws/${sid}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'log') {
        setLogs(prev => [...prev, { type: 'log', content: data.content }]);
      } else if (data.type === 'user') {
        setLogs(prev => [...prev, { type: 'user', content: data.content }]);
      } else if (data.type === 'status' && data.content === 'ready') {
        setIsProcessing(false);
      }
    };

    setSocket(ws);
  };

  const handleSend = () => {
    if (!socket || !input.trim() || isProcessing) return;
    setIsProcessing(true);
    socket.send(input);
    setInput("");
  };

  // 如果没有 Session ID，显示上传界面
  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500">
            <Cpu size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2">Claude Agent Workspace</h1>
          <p className="text-gray-400 mb-8 text-sm">上传项目压缩包 (.zip)，智能体将自动加载并在其中工作。</p>
          
          <div className="border-2 border-dashed border-border rounded-lg p-8 mb-6 hover:border-blue-500 transition-colors cursor-pointer relative">
            <input 
              type="file" 
              accept=".zip"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Upload className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-300">
              {file ? file.name : "点击或拖拽上传 ZIP"}
            </p>
          </div>

          <button 
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Play size={16} />}
            启动智能体
          </button>
        </div>
      </div>
    );
  }

  // 聊天界面
  return (
    <div className="flex flex-col h-screen max-w-5xl mx-auto p-4 md:p-6">
      <header className="flex items-center gap-3 mb-4 pb-4 border-b border-border">
        <div className="w-10 h-10 bg-green-500/10 rounded-lg flex items-center justify-center text-green-500">
          <Terminal size={20} />
        </div>
        <div>
          <h1 className="font-bold text-lg">Agent Session</h1>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Online | ID: {sessionId.slice(0, 8)}
          </div>
        </div>
      </header>

      {/* 终端日志区域 */}
      <div className="flex-1 overflow-y-auto bg-surface border border-border rounded-xl p-4 font-mono text-sm mb-4 shadow-inner">
        {logs.map((log, i) => (
          <div key={i} className={`mb-2 ${log.type === 'user' ? 'text-right' : 'text-left'}`}>
            {log.type === 'user' ? (
              <span className="inline-block bg-blue-600/20 text-blue-200 px-3 py-1 rounded-lg">
                {log.content}
              </span>
            ) : (
              <div className="whitespace-pre-wrap break-words text-gray-300 pl-2 border-l-2 border-gray-700">
                 {/* 如果内容是工具调用，可以根据内容特征给不同颜色，这里简化处理 */}
                 {log.content.includes("Wait") || log.content.includes("Error") 
                    ? <span className="text-yellow-400">{formatLog(log.content)}</span>
                    : formatLog(log.content)
                 }
              </div>
            )}
          </div>
        ))}
        {isProcessing && (
          <div className="flex items-center gap-2 text-gray-500 text-xs mt-2">
            <Loader2 size={12} className="animate-spin" /> Agent is thinking...
          </div>
        )}
        <div ref={logsEndRef} />
      </div>

      {/* 输入框 */}
      <div className="flex gap-2">
        <input 
          type="text" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入指令给智能体..."
          disabled={isProcessing}
          className="flex-1 bg-surface border border-border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all text-white placeholder-gray-600"
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || isProcessing}
          className="bg-white text-black hover:bg-gray-200 px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default App;