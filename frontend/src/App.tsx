import { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Upload, Cpu, Loader2, Layout, Play} from 'lucide-react';
import LogMessage from './components/LogMessage';
import FileExplorer from './components/FileExplorer';
import CodeEditor from './components/CodeEditor';

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [logs, setLogs] = useState<{ type: 'log' | 'user'; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const [fileTree, setFileTree] = useState<any[]>([]);
  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isFileLoading, setIsFileLoading] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  const handleBackToUpload = () => {
    socket?.close();
    setSocket(null);

    setSessionId(null);
    setFile(null);
    setLogs([]);
    setInput("");
    setIsProcessing(false);

    setFileTree([]);
    setSelectedFilePath(null);
    setFileContent("");
    setIsFileLoading(false);
  };

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
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

  const handleDownload = () => {
    if (!sessionId) return;
    window.location.href = `/api/download/${sessionId}`;
  };

  const connectWebSocket = (sid: string) => {
    const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(`${wsProtocol}//${location.host}/ws/${sid}`);

    ws.onopen = () => {
        console.log("WebSocket connected.");
        ws.send(JSON.stringify({ type: "get_file_tree" }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'log') {
        setLogs(prev => [...prev, { type: 'log', content: data.content }]);
      } else if (data.type === 'user') {
        setLogs(prev => [...prev, { type: 'user', content: data.content }]);
      } else if (data.type === 'status' && data.content === 'ready') {
        setIsProcessing(false);
      } else if (data.type === 'file_tree') {
        setFileTree(data.content);
      } else if (data.type === 'file_content') {
        setFileContent(data.content || '');
        setIsFileLoading(false);
      } else if (data.type === 'fs_update') {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "get_file_tree" }));
            if (selectedFilePath) {
                setTimeout(() => {
                  ws.send(JSON.stringify({ type: "read_file", path: selectedFilePath }));
                }, 500);
            }
        }
      }
    };

    ws.onclose = () => {
        console.log("WebSocket disconnected.");
    };

    setSocket(ws);
  };

  const handleSend = () => {
    if (!socket || !input.trim() || isProcessing) return;
    setIsProcessing(true);
    socket.send(JSON.stringify({ type: "user_message", content: input }));
    setInput("");
  };

  const handleFileSelect = useCallback((path: string) => {
    if (socket && path) {
      setSelectedFilePath(path);
      setIsFileLoading(true);
      socket.send(JSON.stringify({ type: "read_file", path }));
    }
  }, [socket]);

  const handleFileSave = useCallback((path: string, content: string) => {
    if (socket && path) {
      // 乐观更新：先不设 loading，或者设一个轻微的 loading
      socket.send(JSON.stringify({ type: "save_file", path, content }));
    }
  }, [socket]);

  // --- 1. 上传界面 ---
  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background text-white">
        <div className="max-w-md w-full bg-surface border border-border rounded-xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-500">
            <Cpu size={32} />
          </div>
          <h1 className="text-2xl font-bold mb-2 text-white">Dev Agent Workspace</h1>
          <p className="text-gray-400 mb-8 text-sm">Upload a project (.zip) to start coding.</p>

          <div className="border-2 border-dashed border-border rounded-lg p-8 mb-6 hover:border-blue-500 transition-colors cursor-pointer relative bg-black/20">
            <input
              type="file"
              accept=".zip"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <Upload className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-300">
              {file ? file.name : "Click or Drag ZIP file here"}
            </p>
          </div>

          <button
            onClick={handleUpload}
            disabled={!file || isUploading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isUploading ? <Loader2 className="animate-spin" /> : <Play size={18} fill="currentColor" />}
            {isUploading ? "Initializing Environment..." : "Start Session"}
          </button>
        </div>
      </div>
    );
  }

  // --- 2. 主工作区界面 (IDE Layout) ---
  return (
    <div className="flex flex-col h-screen bg-background text-gray-300 overflow-hidden font-sans">
      {/* 顶部导航栏 */}
      <header className="h-12 bg-surface border-b border-border flex items-center px-4 justify-between shrink-0">
        <button
          onClick={handleBackToUpload}
          className="flex items-center gap-2 cursor-pointer"
          title="Back to upload"
          type="button"
        >
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
            <Layout size={14} className="text-white" />
          </div>
          <span className="font-semibold text-sm text-white">Agent Workspace</span>
        </button>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 text-green-400 rounded border border-green-500/20">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            Connected
          </div>
          <span className="text-gray-500 font-mono">ID: {sessionId.slice(0, 8)}</span>
          <button
            onClick={handleDownload}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs"
          >
            Download ZIP
          </button>
        </div>
      </header>

      {/* 主体区域：左右分栏 + 底部终端 */}
      <div className="flex-1 flex overflow-hidden">

        {/* 左侧：文件资源管理器 (固定宽度 250px) */}
        <div className="w-64 bg-surface border-r border-border flex flex-col shrink-0">
          <FileExplorer
            files={fileTree}
            onFileSelect={handleFileSelect}
            selectedFilePath={selectedFilePath}
          />
        </div>

        {/* 右侧：编辑器(左) + 智能体(右) */}
        <div className="flex-1 flex min-w-0 overflow-hidden">

          {/* 左侧：代码编辑器区域 */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex-1 min-h-0 relative flex flex-col">
              {!selectedFilePath ? (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 bg-[#1e1e1e]">
                  <Layout size={48} className="mb-4 opacity-20" />
                  <p>Select a file to view or edit</p>
                </div>
              ) : (
                <CodeEditor
                  filePath={selectedFilePath}
                  fileContent={fileContent}
                  onSave={handleFileSave}
                  isLoading={isFileLoading}
                />
              )}
            </div>
          </div>

          {/* 右侧：智能体终端面板（固定宽度，可按需调） */}
          <div className="w-[900px] border-l border-border bg-[#0f0f11] flex flex-col min-w-[320px] max-w-[900px]">
            {/* 标题条 */}
            <div className="h-9 bg-surface border-b border-border flex items-center px-4 gap-4 text-xs font-medium text-gray-400 select-none shrink-0">
              <span className="text-blue-400 border-b-2 border-blue-400 h-full flex items-center px-1">TERMINAL / AGENT</span>
              <span className="hover:text-gray-200 cursor-pointer h-full flex items-center px-1">OUTPUT</span>
            </div>

            {/* 内容区 */}
            <div className="flex-1 p-4 overflow-y-auto custom-scrollbar font-mono text-sm min-h-0">
              <div className="flex flex-col gap-2">
                {logs.map((log, i) => (
                  <LogMessage key={i} content={log.content} type={log.type} />
                ))}
                {isProcessing && (
                  <div className="flex items-center gap-2 text-blue-400 text-xs mt-2 pl-1">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Agent is working...</span>
                  </div>
                )}
                <div ref={logsEndRef} />
              </div>
            </div>

            {/* 输入框 */}
            <div className="p-3 bg-surface border-t border-border shrink-0">
              <div className="relative">
                <Terminal size={16} className="absolute left-3 top-3 text-gray-500" />
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Instruct the agent (e.g., 'Create a hello world python script')..."
                  disabled={isProcessing}
                  className="w-full bg-black/30 border border-border rounded-md pl-10 pr-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder-gray-600 font-mono"
                />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

export default App;