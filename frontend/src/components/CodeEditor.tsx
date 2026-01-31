import React, { useState, useEffect } from 'react';
import AceEditor from 'react-ace';

import 'ace-builds/src-noconflict/mode-python';
import 'ace-builds/src-noconflict/mode-javascript';
import 'ace-builds/src-noconflict/mode-typescript';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/mode-markdown';
import 'ace-builds/src-noconflict/mode-html';
import 'ace-builds/src-noconflict/mode-css'; 
import 'ace-builds/src-noconflict/theme-dracula';

interface CodeEditorProps {
  filePath: string | null;
  fileContent: string;
  onSave: (path: string, content: string) => void;
  isLoading: boolean;
}

const CodeEditor: React.FC<CodeEditorProps> = ({ filePath, fileContent, onSave, isLoading }) => {
  const [currentContent, setCurrentContent] = useState(fileContent);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (fileContent !== currentContent) {
      setCurrentContent(fileContent);
    }
    setIsDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileContent, filePath]); 

  const getMode = (path: string | null) => {
    if (!path) return 'text';
    const ext = path.split('.').pop();
    switch (ext) {
      case 'py': return 'python';
      case 'js': return 'javascript';
      case 'ts': case 'tsx': return 'typescript';
      case 'json': return 'json';
      case 'md': return 'markdown';
      case 'html': case 'htm': return 'html';
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

  const handleChange = (newValue: string) => {
    setCurrentContent(newValue);
    setIsDirty(true);
  };

  return (
    <div className="flex flex-col h-full bg-[#282a36] border-l border-gray-700 rounded-lg overflow-hidden shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-sm text-gray-300 font-mono truncate max-w-[70%]">
          {filePath ? filePath : "No file selected"} 
          {isDirty && <span className="text-yellow-400 font-bold"> • Unsaved</span>}
        </span>
        <button
          onClick={handleSave}
          disabled={!isDirty || !filePath || isLoading}
          className={`
            text-xs px-3 py-1 rounded-md transition-colors 
            ${(!isDirty || !filePath || isLoading) 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50' 
              : 'bg-blue-600 hover:bg-blue-500 text-white cursor-pointer'}
          `}
        >
          {isLoading ? "Saving..." : "Save"}
        </button>
      </div>

      <AceEditor
        key={filePath || 'empty-editor'}
        mode={getMode(filePath)}
        theme="dracula"
        name="code_editor"
        fontSize={14}
        showPrintMargin={false}
        showGutter={true}
        highlightActiveLine={true}
        value={currentContent}
        onChange={handleChange}
        setOptions={{
          enableBasicAutocompletion: true,
          enableLiveAutocompletion: true,
          enableSnippets: true,
          showLineNumbers: true,
          tabSize: 2,
          useWorker: false
        }}
        width="100%"
        height="100%"
        className="flex-1"
      />
    </div>
  );
};

export default CodeEditor;