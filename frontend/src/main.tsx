import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import './index.css'
import App from './App.tsx'

// 创建暗色主题（与你的编辑器/文件资源管理器暗色风格匹配）
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#0f172a', // 如需要可匹配你的 Tailwind bg-surface
      paper: '#1e293b',
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={darkTheme}>
      <CssBaseline /> {/* MUI 的 CSS 重置，可选但建议保留 */}
      <App />
    </ThemeProvider>
  </StrictMode>,
)