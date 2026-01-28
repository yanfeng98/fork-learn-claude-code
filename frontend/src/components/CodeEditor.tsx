import React, { useState, useEffect } from 'react';
import AceEditor from 'react-ace';

// Ace Editor 模式和主题
import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/theme-dracula'; // 使用一个暗黑主题

interface CodeEditorProps {
  filePath: string | null;
  fileContent: string;
  onSave: (path: string, content: string) => void;
  isLoading: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ filePath, fileContent, onSave, isLoading }) => {
  const [currentContent, setCurrentContent] = useState(fileContent);
  const [isDirty, setIsDirty] = useState(false); // 标记文件是否已修改

  useEffect(() => {
    setCurrentContent(fileContent);
    setIsDirty(false); // 切换文件时重置 dirty 状态
  }, [fileContent, filePath]);

  const getMode = (path: string | null) => {
    if (!path) return 'text';
    const ext = path.split('.').pop();
    switch (ext) {
      case 'py': return 'python';
      case 'js': return 'javascript';
      case 'ts': return 'typescript';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'html':
      case 'htm': return 'html';
      case 'css': return 'css';
      default: return 'text';
    }
  };

  const handleSave = () => {
    if (filePath && isDirty) {
      onSave(filePath, currentContent);
      setIsDirty(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border rounded-lg overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-border">
        <span className="text-sm text-gray-300 font-mono">
          {filePath ? filePath : "No file selected"} {isDirty && <span className="text-yellow-400"> (Unsaved)</span>}
        </span>
        <button
          onClick={handleSave}
          disabled={!isDirty || !filePath || isLoading}
          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>

      <AceEditor
        mode={getMode(filePath)}
        theme="dracula"
        name="code_editor"
        fontSize={14}
        showPrintMargin={false}
        showGutter={true} // 显示行号
        highlightActiveLine={true}
        value={currentContent}
        onChange={(newValue) => {
          setCurrentContent(newValue);
          setIsDirty(true);
        }}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
        }}
        width="100%"
        height="100%"
        className="flex-1" // 撑满剩余空间
      />
    </div>
  );
};

export default CodeEditor;