import React from 'react';
import { File, Folder } from 'lucide-react';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { ScrollArea } from '@radix-ui/react-scroll-area';
import { alpha, styled } from '@mui/material/styles';

// 为了保持接口完全一致，保留 ITreeItem 类型定义（虽然内部不再使用 tree-view-react）
export interface ITreeItem {
  id: string;
  label: string;
  children?: ITreeItem[];
  icon?: React.ReactNode;
  data?: any;
}

interface FileExplorerProps {
  files: ITreeItem[];
  onFileSelect: (path: string) => void;
  selectedFilePath: string | null;
}

// 自定义 TreeItem 样式，匹配原有的 Tailwind 设计
const StyledTreeItem = styled(TreeItem)(({ theme }) => ({
  '& .MuiTreeItem-content': {
    padding: '6px 8px',
    margin: '2px 0',
    borderRadius: '4px',
    color: '#d1d5db', // text-gray-300
    '&:hover': {
      backgroundColor: 'rgba(55, 65, 81, 0.5)', // hover:bg-gray-700/50
    },
    '&.Mui-selected': {
      backgroundColor: 'rgba(37, 99, 235, 0.3)', // bg-blue-600/30
      color: '#ffffff',
      '&:hover': {
        backgroundColor: 'rgba(37, 99, 235, 0.4)',
      },
    },
  },
  '& .MuiTreeItem-iconContainer': {
    marginRight: '4px',
  },
  '& .MuiTreeItem-label': {
    fontSize: '0.875rem',
    fontFamily: 'inherit',
  },
}));

const FileExplorer: React.FC<FileExplorerProps> = ({ files, onFileSelect, selectedFilePath }) => {
  // 转换文件列表为 MUI TreeView 兼容的格式（保持与原代码逻辑一致）
  const transformToTreeItems = (items: any[]): any[] => {
    return items.map(item => ({
      id: item.path,
      label: item.name,
      ...(item.type === 'directory' && {
        children: transformToTreeItems(item.children || []),
      }),
      data: item.path,
      type: item.type,
    }));
  };

  const treeItems = transformToTreeItems(files);

  // 递归渲染树节点
  const renderTree = (items: any[]) => {
    return items.map((item) => {
      const isSelected = item.id === selectedFilePath;
      const isDirectory = item.type === 'directory';

      return (
        <StyledTreeItem
          key={item.id}
          itemId={item.id}
          label={
            <div className="flex items-center truncate">
              {isDirectory ? (
                <Folder size={16} className="text-blue-400 mr-2 flex-shrink-0" />
              ) : (
                <File size={16} className="text-gray-400 mr-2 flex-shrink-0" />
              )}
              <span className="truncate">{item.label}</span>
            </div>
          }
          slotProps={{
            content: {
              className: isSelected ? 'Mui-selected bg-blue-600/50 font-medium' : '',
              onClick: () => onFileSelect(item.data),
            },
          }}
        >
          {item.children && renderTree(item.children)}
        </StyledTreeItem>
      );
    });
  };

  return (
    <div className="w-full h-full bg-surface border-r border-border flex flex-col">
      <div className="flex items-center p-3 border-b border-border">
        <Folder size={18} className="text-white mr-2" />
        <h3 className="text-md font-semibold text-white">Workspace</h3>
      </div>
      <ScrollArea className="flex-1 overflow-y-auto">
        {treeItems.length > 0 ? (
          <SimpleTreeView
            defaultExpandedItems={treeItems.map(item => item.id)} // 相当于 defaultExpandAll
            selectedItems={selectedFilePath ?? undefined} // ✅ 修复：改为 string | undefined
            onItemClick={(event, itemId) => onFileSelect(itemId)}
            sx={{
              padding: '4px',
              '& .MuiTreeItem-root': {
                paddingLeft: '8px', // 基础缩进
              },
            }}
          >
            {renderTree(treeItems)}
          </SimpleTreeView>
        ) : (
          <p className="text-gray-500 text-sm p-4 text-center">No files in workspace.</p>
        )}
        <div className="h-4" />
      </ScrollArea>
    </div>
  );
};

export default FileExplorer;