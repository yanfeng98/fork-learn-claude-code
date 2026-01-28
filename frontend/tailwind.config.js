export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./node_modules/tree-view-react/dist/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        background: "#09090b",
        surface: "#18181b",
        border: "#27272a",
        'accent-dark': '#0f172a',
        'accent-light': '#1e293b',
      },
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
    require('@tailwindcss/typography'),
  ],
}