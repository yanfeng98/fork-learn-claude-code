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
      },
      // 自定义 Typography 样式（可选，让代码块背景更贴合）
      typography: (theme) => ({
        DEFAULT: {
          css: {
            color: theme('colors.gray.300'),
            a: {
              color: theme('colors.blue.400'),
              '&:hover': {
                color: theme('colors.blue.300'),
              },
            },
            strong: {
              color: theme('colors.white'),
            },
            'h1, h2, h3, h4': {
              color: theme('colors.white'),
              fontWeight: '600',
            },
            code: {
              color: theme('colors.orange.300'),
              backgroundColor: 'rgba(255,255,255,0.1)',
              borderRadius: '0.25rem',
              padding: '0.1rem 0.3rem',
              fontWeight: '400',
            },
            'code::before': { content: '""' },
            'code::after': { content: '""' },
          },
        },
      }),
    },
  },
  plugins: [
    require('@tailwindcss/typography'), // 添加这一行
  ],
}