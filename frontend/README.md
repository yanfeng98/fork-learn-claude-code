# 前端环境搭建 (Frontend)

## Installation

### 1. 初始化 React + Vite

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend

npm install
```

### 2. 配置 Tailwind CSS (CSS 框架)

```bash
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

修改 `frontend/tailwind.config.js`，确保 `content` 包含你的文件：

```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        surface: "#18181b",
        border: "#27272a",
      }
    },
  },
  plugins: [],
}
```

修改 `frontend/src/index.css`，清空内容并填入：

```js
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #09090b;
  color: #e4e4e7;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}

::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: #09090b;
}
::-webkit-scrollbar-thumb {
  background: #3f3f46;
  border-radius: 4px;
}
```

### 3. 安装 Shadcn UI 组件

```bash
npm install lucide-react clsx tailwind-merge
```

### 4. 安装 ANSI 解析器和代码高亮器

```bash
npm install ansi-to-react react-markdown react-syntax-highlighter remark-gfm
npm install --save-dev @types/react-syntax-highlighter
```

### 5. 安装 Tailwind Typography 插件

```bash
npm install -D @tailwindcss/typography
```

## 运行前端

```bash
# http://localhost:5173
npm run dev
```
